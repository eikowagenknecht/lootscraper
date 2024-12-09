import { EpicGamesScraper } from "@/scrapers";
import { browser } from "@/services/browser";
import { config } from "@/services/config";
import { database } from "@/services/database";
import { DatabaseOperations } from "@/services/database/operations";
import { handleError } from "@/utils/errorHandler";
import { initializeFileTransport, logger } from "@/utils/logger";
import { AmazonGamesScraper } from "./scrapers/implementations/amazon/games";

async function main(): Promise<void> {
  try {
    // Load config first
    config.loadConfig();

    // Initialize file logging if in production
    initializeFileTransport();

    logger.info("Starting LootScraper...");

    // Initialize services
    await database.initialize(config.get());
    await browser.initialize(config.get());

    // Create database operations instance
    const dbOps = new DatabaseOperations(database.get());

    // Test Epic Games scraper
    const epicScraper = new EpicGamesScraper(
      browser.getContext(),
      config.get(),
      dbOps,
    );

    logger.info("Starting Epic Games scraper test...");
    const offers = await epicScraper.scrape();

    // Store offers in database
    for (const offer of offers) {
      await dbOps.createOrUpdateOffer(offer);
    }

    // Test Amazon scraper
    const amazonScraper = new AmazonGamesScraper(
      browser.getContext(),
      config.get(),
      dbOps,
    );

    const amazonOffers = await amazonScraper.scrape();

    // Store Amazon offers in database
    for (const offer of amazonOffers) {
      await dbOps.createOrUpdateOffer(offer);
    }

    logger.info("Scraping completed successfully");

    // Cleanup
    await browser.destroy();
    await database.destroy();
  } catch (error) {
    handleError(error);
    process.exit(1);
  }
}

main().catch(handleError);

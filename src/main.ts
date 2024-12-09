import {
  // AmazonGamesScraper,
  // AmazonLootScraper,
  // AppleGamesScraper,
  // EpicGamesScraper,
  // GoogleGamesScraper,
  // HumbleGamesScraper,
  // SteamGamesScraper,
  // SteamLootScraper,
  // GogGamesScraper,
  // GogGamesAlwaysFreeScraper
  UbisoftGamesScraper,
} from "@/scrapers";
import { browser } from "@/services/browser";
import { config } from "@/services/config";
import { database } from "@/services/database";
import { DatabaseOperations } from "@/services/database/operations";
import { handleError } from "@/utils/errorHandler";
import { initializeFileTransport, logger } from "@/utils/logger";

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
    const scraper = new UbisoftGamesScraper(
      browser.getContext(),
      config.get(),
      dbOps,
    );

    logger.info("Starting scraper test...");
    const offers = await scraper.scrape();

    // Store offers in database
    for (const offer of offers) {
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

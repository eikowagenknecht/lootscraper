import {
  // AmazonGamesScraper,
  // AmazonLootScraper,
  // AppleGamesScraper,
  EpicGamesScraper,
  // GoogleGamesScraper,
  // HumbleGamesScraper,
  // SteamGamesScraper,
  // SteamLootScraper,
  // GogGamesScraper,
  // GogGamesAlwaysFreeScraper
  // UbisoftGamesScraper,
} from "@/scrapers";
import { browser } from "@/services/browser";
import { config } from "@/services/config";
import { database } from "@/services/database";
import { handleError } from "@/utils/errorHandler";
import {
  initializeFileTransport,
  logger,
  updateConsoleLevel,
} from "@/utils/logger";
import { createOrUpdateOffer } from "./services/database/offerRepository";

async function main(): Promise<void> {
  try {
    // Load config first
    config.loadConfig();

    // Update logging settings from config
    const configuredLevel = config.get().common.logLevel;
    updateConsoleLevel(configuredLevel);
    initializeFileTransport(configuredLevel, config.get().common.logFile);

    logger.info("Starting LootScraper...");

    // Initialize services
    await database.initialize(config.get());
    await browser.initialize(config.get());

    // Test Epic Games scraper
    const scraper = new EpicGamesScraper(browser.getContext(), config.get());

    logger.info("Starting scraper test...");
    const offers = await scraper.scrape();

    // Store offers in database
    for (const offer of offers) {
      await createOrUpdateOffer(offer);
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

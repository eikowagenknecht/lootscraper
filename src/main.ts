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
import { Settings as LuxonSettings } from "luxon";
import { DateTime } from "luxon";
import {
  createOrUpdateOffer,
  getActiveOffers,
  getAllOffers,
} from "./services/database/offerRepository";
import { FeedService } from "./services/feed";

async function main(): Promise<void> {
  try {
    // Load config first
    config.loadConfig();

    // Update logging settings from config
    const configuredLevel = config.get().common.logLevel;
    updateConsoleLevel(configuredLevel);
    initializeFileTransport(configuredLevel, config.get().common.logFile);

    logger.info("Starting LootScraper...");

    // Set time zone
    LuxonSettings.defaultZone = "utc";

    // // Set a fixed start time for all tests
    // const referenceDate = 1733055717000; // 2024-12-01T12:21:57.000Z
    // const offset = DateTime.now().toMillis() - referenceDate;
    // LuxonSettings.now = () => Date.now() - offset; // 2024-12-01T12:21:57.000Z

    // Initialize services
    await database.initialize(config.get());
    await browser.initialize(config.get());

    // Initialize feed service
    const feedService = new FeedService(config.get());

    // Get all offers
    const activeOffers = await getActiveOffers(DateTime.now().toJSDate());
    const allOffers = await getAllOffers();

    // Generate feeds
    logger.info("Generating feeds...");
    await feedService.generateFeeds(activeOffers, allOffers);

    if (config.get().scraper.offerSources.length > 0) {
      // Test Epic Games scraper
      const scraper = new EpicGamesScraper(browser.getContext(), config.get());

      logger.info("Starting scraper test...");
      const offers = await scraper.scrape();

      // Store offers in database
      for (const offer of offers) {
        await createOrUpdateOffer(offer);
      }

      logger.info("Scraping completed successfully");
    }
    // Cleanup
    await browser.destroy();
    await database.destroy();
  } catch (error) {
    handleError(error);
    process.exit(1);
  }
}

main().catch(handleError);

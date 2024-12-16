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
import { config as configService } from "@/services/config";
import { database } from "@/services/database";
import { handleError } from "@/utils/errorHandler";
import {
  initializeFileTransport,
  logger,
  updateConsoleLevel,
} from "@/utils/logger";
import { Settings as LuxonSettings } from "luxon";
import { DateTime } from "luxon";
import { telegramBotService } from "./bot/service";
import {
  createOrUpdateOffer,
  getActiveOffers,
  getAllOffers,
} from "./services/database/offerRepository";
import { FeedService } from "./services/feed";

async function shutdown() {
  logger.info("Shutting down...");
  await telegramBotService.stop();
  await browser.destroy();
  await database.destroy();
}

async function main(): Promise<void> {
  try {
    // Load config first
    configService.loadConfig();
    const config = configService.get();

    // Update logging settings from config
    const configuredLevel = config.common.logLevel;
    updateConsoleLevel(configuredLevel);
    initializeFileTransport(configuredLevel, config.common.logFile);

    logger.info("Starting LootScraper...");

    // Set time zone
    LuxonSettings.defaultZone = "utc";

    // // Set a fixed start time for all tests
    // const referenceDate = 1733055717000; // 2024-12-01T12:21:57.000Z
    // const offset = DateTime.now().toMillis() - referenceDate;
    // LuxonSettings.now = () => Date.now() - offset; // 2024-12-01T12:21:57.000Z

    // Safe shutdown handling
    // TODO: Check typing etc. and add "SIGTERM" handling
    process.on("SIGINT", (() => {
      void (async () => {
        await shutdown();
        process.exit(0);
      })();
    }) as NodeJS.SignalsListener);

    logger.info("Initializing database service...");
    await database.initialize(config);

    if (config.actions.telegramBot) {
      logger.info("Running Telegram bot...");
      await telegramBotService.initialize(config);
      await telegramBotService.start();
    }

    if (config.actions.generateFeed) {
      logger.info("Generating feeds...");
      const feedService = new FeedService(config);
      const activeOffers = await getActiveOffers(DateTime.now().toJSDate());
      const allOffers = await getAllOffers();
      await feedService.generateFeeds(activeOffers, allOffers);
    }

    if (config.actions.scrapeOffers && config.scraper.offerSources.length > 0) {
      logger.info("Scraping offers...");
      await browser.initialize(config);

      // TODO: Implement scraper selection
      // Test Epic Games scraper
      const scraper = new EpicGamesScraper(
        browser.getContext(),
        configService.get(),
      );

      const offers = await scraper.scrape();

      // Store offers in database
      for (const offer of offers) {
        await createOrUpdateOffer(offer);
      }

      logger.info("Scraping completed successfully");
    }

    await shutdown();
  } catch (error) {
    handleError(error);
    try {
      await shutdown();
    } catch {
      // Ignore errors during error triggered shutdown.
    }
    process.exit(1);
  }
}

main().catch(handleError);

import { telegramBotService } from "@/bot/service";
import {
  AmazonGamesScraper,
  AmazonLootScraper,
  AppleGamesScraper,
  EpicGamesScraper,
  GogGamesAlwaysFreeScraper,
  GogGamesScraper,
  GoogleGamesScraper,
  HumbleGamesScraper,
  SteamGamesScraper,
  SteamLootScraper,
  UbisoftGamesScraper,
} from "@/scrapers";
import type { BaseScraper } from "@/scrapers/base/scraper";
import { browser } from "@/services/browser";
import { config } from "@/services/config";
import { database } from "@/services/database";
import {
  createOrUpdateOffer,
  getActiveOffers,
  getAllOffers,
} from "@/services/database/offerRepository";
import type { Config } from "@/types/config";
import { logger } from "@/utils/logger";
import { Cron } from "croner";
import type { BrowserContext } from "playwright";
import { FeedService } from "./feed";

interface ServiceState {
  isRunning: boolean;
  scrapeJobs: Cron[];
  currentScrape: Promise<void> | null;
  scrapeQueue: (() => Promise<void>)[];
}

const state: ServiceState = {
  isRunning: false,
  scrapeJobs: [],
  currentScrape: null,
  scrapeQueue: [],
};

/**
 * Initialize application services based on config
 */
export async function initializeServices(): Promise<void> {
  if (state.isRunning) {
    logger.warn("Services already initialized");
    return;
  }

  try {
    const cfg = config.get();

    // Initialize core services
    logger.info("Initializing database service...");
    await database.initialize(cfg);

    // Initialize optional services based on config
    if (cfg.actions.telegramBot) {
      logger.info("Initializing Telegram bot...");
      await telegramBotService.initialize(cfg);
    }

    if (cfg.actions.scrapeOffers) {
      logger.info("Initializing browser service...");
      await browser.initialize(cfg);
    }

    state.isRunning = true;
    logger.info("Service initialization complete");

    // Start services and schedule jobs
    startServices();
    registerShutdownHandlers();
  } catch (error) {
    await shutdownServices();
    throw error;
  }
}

const SCRAPERS = [
  AppleGamesScraper,
  AmazonGamesScraper,
  AmazonLootScraper,
  EpicGamesScraper,
  GoogleGamesScraper,
  HumbleGamesScraper,
  SteamGamesScraper,
  SteamLootScraper,
  UbisoftGamesScraper,
  GogGamesScraper,
  GogGamesAlwaysFreeScraper,
] as const;

/**
 * Run scraper ensuring only one runs at a time
 */
async function runScraper(task: () => Promise<void>): Promise<void> {
  if (state.currentScrape) {
    // If a scrape is running, queue this one
    logger.debug("Adding scrape task to queue");
    return new Promise((resolve) => {
      state.scrapeQueue.push(async () => {
        await task();
        resolve();
      });
    });
  }

  try {
    // Set current scrape and run it
    state.currentScrape = task();
    await state.currentScrape;
  } finally {
    state.currentScrape = null;

    // Process next in queue if any
    const nextTask = state.scrapeQueue.shift();
    if (nextTask) {
      logger.debug("Processing next queued scrape task");
      void runScraper(nextTask);
    }
  }
}

interface ScrapeResult {
  newOffersFound: boolean;
  offerCount: number;
}

/**
 * Run scraping for a single scraper and store results
 */
async function runSingleScrape(
  scraper: BaseScraper,
  context = "scheduled",
): Promise<ScrapeResult> {
  logger.info(
    `Starting ${context} scrape for ${scraper.getSource()} ${scraper.getType()}...`,
  );

  const offers = await scraper.scrape();

  // Store offers and track if we found any new ones
  let newOffersFound = false;
  for (const offer of offers) {
    const result = await createOrUpdateOffer(offer);
    // If result is a number, it's a new offer's ID
    if (typeof result === "number") {
      newOffersFound = true;
    }
  }

  logger.info(
    `Completed ${context} scrape with ${offers.length.toFixed()} offers`,
  );

  return {
    newOffersFound,
    offerCount: offers.length,
  };
}

/**
 * Update feeds if new offers were found
 */
async function updateFeeds(): Promise<void> {
  const cfg = config.get();
  if (!cfg.actions.generateFeed) {
    return;
  }

  logger.info("New offers found, regenerating feeds...");
  const feedService = new FeedService(cfg);
  const activeOffers = await getActiveOffers(new Date());
  const allOffers = await getAllOffers();
  await feedService.generateFeeds(activeOffers, allOffers);
}

/**
 * Schedule regular scraping for a scraper
 */
function scheduleScraper(scraper: BaseScraper): void {
  // Schedule scraper based on its defined schedule
  for (const schedule of scraper.getSchedule()) {
    const job = new Cron(
      schedule.schedule,
      { timezone: schedule.timezone ?? "UTC" },
      () => {
        void runScraper(async () => {
          try {
            const result = await runSingleScrape(scraper);
            if (result.newOffersFound) {
              await updateFeeds();
            }
          } catch (error) {
            logger.error(
              `Failed to scrape ${scraper.getSource()} ${scraper.getType()}: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        });
      },
    );
    state.scrapeJobs.push(job);
  }
}

/**
 * Run initial scrape for all enabled scrapers
 */
function runInitialScrapes(scrapers: BaseScraper[]): void {
  logger.info("Running initial scrape for all enabled scrapers...");

  for (const scraper of scrapers) {
    void runScraper(async () => {
      try {
        const result = await runSingleScrape(scraper, "initial");
        if (result.newOffersFound) {
          await updateFeeds();
        }
      } catch (error) {
        logger.error(
          `Failed initial scrape for ${scraper.getSource()} ${scraper.getType()}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }
}

/**
 * Get enabled scrapers based on config
 */
function getEnabledScrapers(
  context: BrowserContext,
  cfg: Config,
): BaseScraper[] {
  return SCRAPERS.map((ScraperClass) => new ScraperClass(context, cfg)).filter(
    (scraper) =>
      cfg.scraper.offerSources.includes(scraper.getSource()) &&
      cfg.scraper.offerTypes.includes(scraper.getType()),
  ) as BaseScraper[];
}

/**
 * Start all active services and schedule scraper jobs
 */
function startServices() {
  const cfg = config.get();

  // Start Telegram bot if enabled
  if (cfg.actions.telegramBot) {
    // Do not await bot start to prevent blocking
    void telegramBotService.start();
  }

  // Initialize and schedule scrapers if enabled
  if (cfg.actions.scrapeOffers) {
    const context = browser.getContext();
    const enabledScrapers = getEnabledScrapers(context, cfg);

    // Setup schedules for each scraper
    for (const scraper of enabledScrapers) {
      scheduleScraper(scraper);
    }

    // Run initial scrapes
    runInitialScrapes(enabledScrapers);
  }
}

/**
 * Gracefully shut down all services
 */
export async function shutdownServices(): Promise<void> {
  logger.info("Shutting down services...");

  // Stop all scraper jobs and clear queue
  for (const job of state.scrapeJobs) {
    job.stop();
  }
  state.scrapeJobs = [];
  state.scrapeQueue = [];

  // Wait for current scrape to finish if any
  if (state.currentScrape) {
    try {
      await state.currentScrape;
    } catch (error) {
      logger.error("Error while waiting for current scrape to finish:", error);
    }
  }

  // Shutdown services in reverse order of initialization
  await telegramBotService.stop();
  await browser.destroy();
  await database.destroy();

  state.isRunning = false;
  logger.info("Services shutdown complete");
}

/**
 * Register handlers for graceful shutdown
 */
function registerShutdownHandlers(): void {
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, initiating graceful shutdown...`);
    await shutdownServices();
    process.exit(0);
  };

  // Handle termination signals
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  // Handle uncaught errors
  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception:", error);
    void shutdown("UNCAUGHT_EXCEPTION");
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled rejection:", reason);
    void shutdown("UNHANDLED_REJECTION");
  });
}

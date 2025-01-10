import { telegramBotService } from "@/bot/service";
import {
  type ScraperInstance,
  getEnabledScraperClasses,
} from "@/scrapers/utils";
import { browser } from "@/services/browser";
import { config } from "@/services/config";
import { database } from "@/services/database";
import {
  addMissingFieldsToOffer,
  createOffer,
  findOffer,
  getActiveOffers,
  getAllOffers,
} from "@/services/database/offerRepository";
import { addTelegramTransport, logger } from "@/utils/logger";
import { getAllEnabledFeedFilenames } from "@/utils/stringTools";
import { Cron } from "croner";
import { DateTime } from "luxon";
import { FeedService } from "./feed";
import { uploadMultipleFiles } from "./ftp";
import { GameInfoService } from "./gameinfo";
import { translationService } from "./translation";

interface ServiceState {
  isRunning: boolean;
  scrapeJobs: Cron[];
  currentTask: Promise<void> | null;
  taskQueue: (() => Promise<void>)[];
}

const state: ServiceState = {
  isRunning: false,
  scrapeJobs: [],
  currentTask: null,
  taskQueue: [],
};

let totalScrapeCount = 0;

/**
 * Run tasks ensuring only one runs at a time
 */
async function runTask(task: () => Promise<void>): Promise<void> {
  if (state.currentTask) {
    // If a task is running, queue this one
    logger.debug("Adding task to queue.");
    return new Promise((resolve) => {
      state.taskQueue.push(async () => {
        await task();
        resolve();
      });
    });
  }

  try {
    // Set current task and run it
    state.currentTask = task();
    await state.currentTask;
  } finally {
    state.currentTask = null;

    // Process next in queue if any
    const nextTask = state.taskQueue.shift();
    if (nextTask) {
      logger.debug("Processing next queued task.");
      void runTask(nextTask);
    }
  }
}

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
    logger.info("Initializing translation service...");
    await translationService.initialize();

    logger.info("Initializing database service...");
    await database.initialize(cfg);

    // Initialize optional services based on config
    if (cfg.actions.telegramBot) {
      logger.info("Initializing Telegram bot...");
      await telegramBotService.initialize(cfg);

      // Add Telegram logging transport after bot is initialized
      logger.info("Adding Telegram transport to logger...");
      addTelegramTransport(cfg.telegram.logLevel, cfg.telegram.botLogChatId);
      logger.info("Telegram transport added to logger.");
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

    // Run initial tasks
    logger.info("Running initial tasks...");
    await runInitialTasks();
  } catch (error) {
    await shutdownServices();
    throw error;
  }
}

async function runInitialTasks(): Promise<void> {
  await updateFeeds();
  await uploadFeedsToServer();
  queueInitialScrapes();
}

function queueInitialScrapes(): void {
  const cfg = config.get();
  if (cfg.actions.scrapeOffers) {
    // Run all enabled scrapers once on startup
    const enabledScrapers = getEnabledScraperClasses();

    const context = browser.getContext();
    for (const scraper of enabledScrapers) {
      const scraperInstance = new scraper(context, config.get());
      queueScraper(scraperInstance);
    }
  }
}

/**
 * Run scraping for a single scraper and store results
 */
async function runSingleScrape(scraper: ScraperInstance): Promise<void> {
  logger.info(
    `Starting scrape run #${totalScrapeCount.toFixed()} for ${scraper.getSource()} ${scraper.getType()}...`,
  );

  const offers = await scraper.scrape();

  // Store offers and track if we found any new ones
  const newOfferIds: number[] = [];
  const modifiedOfferIds: number[] = [];

  for (const newOffer of offers) {
    // Offers that are neither new nor updated just get a new "last seen" date
    // Offers that are new get inserted into the database
    const existingOffer = await findOffer({
      duration: newOffer.duration,
      source: newOffer.source,
      title: newOffer.title,
      type: newOffer.type,
      validTo: newOffer.valid_to ?? null,
    });

    if (existingOffer) {
      // Touch the offer's last seen date as we have seen it again
      const changed = await addMissingFieldsToOffer(existingOffer.id, newOffer);

      if (changed) {
        modifiedOfferIds.push(existingOffer.id);
        logger.verbose(`Updated offer ${existingOffer.id.toFixed()}.`);
      }

      continue;
    }

    // Create new offer if it doesn't exist
    newOfferIds.push(await createOffer(newOffer));
  }

  logger.info(
    `Completed scrape with ${offers.length.toFixed()} offers (${newOfferIds.length.toFixed()} new).`,
  );

  if (newOfferIds.length === 0 && modifiedOfferIds.length === 0) {
    return;
  }

  await updateGameInfo(newOfferIds);
  await updateGameInfo(modifiedOfferIds);
  await updateFeeds();
  await uploadFeedsToServer();
  // TODO: Send offers to Telegram
}

/**
 * Update game information if new offers were found
 */
async function updateGameInfo(gameIds: number[]): Promise<void> {
  const cfg = config.get();
  if (!cfg.actions.scrapeInfo || gameIds.length === 0) {
    return;
  }

  logger.info("New offers found, fetching game information ...");
  const gameInfoService = new GameInfoService(cfg, browser.getContext());
  for (const gameId of gameIds) {
    await gameInfoService.enrichOffer(gameId);
  }
}

/**
 * Update feeds if new offers were found or old ones updated
 */
async function updateFeeds(): Promise<void> {
  const cfg = config.get();
  if (!cfg.actions.generateFeed) {
    return;
  }

  logger.info("New offers found, regenerating feeds...");
  const feedService = new FeedService(cfg);
  const activeOffers = await getActiveOffers(DateTime.now());
  const allOffers = (await getAllOffers()).filter(
    (offer) =>
      // Skip entries without dates or entries that start in the future
      (offer.valid_from ?? offer.seen_last) &&
      (!offer.valid_from || offer.valid_from > offer.seen_last),
  );

  await feedService.generateFeeds(activeOffers, allOffers);
}

async function uploadFeedsToServer(): Promise<void> {
  const cfg = config.get();
  if (!cfg.actions.uploadToFtp || !cfg.actions.generateFeed) return;

  try {
    const feedFiles = getAllEnabledFeedFilenames(cfg.common.feedFilePrefix);
    const uploadResults = await uploadMultipleFiles(feedFiles);
    for (const result of uploadResults) {
      if (result.success) {
        logger.info(`Uploaded ${result.fileName}.`);
      } else {
        logger.error(`Failed to upload ${result.fileName}: ${result.error}`);
      }
    }
  } catch (error) {
    logger.error(
      `Failed to upload feeds: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
}

function queueScraper(scraper: ScraperInstance): void {
  void runTask(async () => {
    try {
      totalScrapeCount++;
      await runSingleScrape(scraper);
    } catch (error) {
      logger.error(
        `Failed to scrape ${scraper.getSource()} ${scraper.getType()}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });
}

/**
 * Schedule regular scraping for a scraper
 */
function scheduleScraper(scraper: ScraperInstance): void {
  // Schedule scraper based on its defined schedule
  for (const schedule of scraper.getSchedule()) {
    const job = new Cron(
      schedule.schedule,
      { timezone: schedule.timezone ?? "UTC" },
      () => {
        queueScraper(scraper);
      },
    );
    state.scrapeJobs.push(job);
  }
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
    const enabledScrapers = getEnabledScraperClasses();

    // Setup schedules for each scraper
    const context = browser.getContext();
    for (const scraper of enabledScrapers) {
      const scraperInstance = new scraper(context, cfg);
      scheduleScraper(scraperInstance);
    }
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
  state.taskQueue = [];

  // Wait for current scrape to finish if any
  if (state.currentTask) {
    try {
      await state.currentTask;
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
    logger.error("Unhandled Promise rejection:", reason);
    void shutdown("UNHANDLED_REJECTION");
  });
}

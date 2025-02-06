import { browserService } from "@/services/browser";
import { config } from "@/services/config";
import { database } from "@/services/database";
import { telegramBotService } from "@/services/telegrambot";
import type { Config } from "@/types";
import { addTelegramTransport, logger } from "@/utils/logger";
import { feedService } from "./feed";
import { ftpService } from "./ftp";
import { gameInfoService } from "./gameinfo";
import { scraperService } from "./scraper";
import { translationService } from "./translation";

interface ServiceState {
  isRunning: boolean;
}

const state: ServiceState = {
  isRunning: false,
};

/**
 * Initialize application services based on config
 */
export async function startApp(): Promise<void> {
  if (state.isRunning) {
    logger.warn("App already started.");
    return;
  }

  try {
    const cfg = config.get();

    // Initialize services
    logger.info("Inizializing services.");
    await initializeServices(cfg);

    // Start services
    logger.info("Starting services.");
    await startServices();
    state.isRunning = true;

    // Register shutdown handlers
    registerShutdownHandlers();

    // Run initial tasks
    logger.info("Running initial tasks.");
    if (cfg.actions.generateFeed) {
      await feedService.updateFeeds();
    }
    if (cfg.actions.generateFeed && cfg.actions.uploadToFtp) {
      await ftpService.uploadEnabledFeedsToServer();
    }
  } catch (error) {
    await shutdownApp();
    throw error;
  }
}

async function initializeServices(cfg: Config): Promise<void> {
  // Initialize core services
  logger.info("Initializing translation service.");
  await translationService.initialize();

  logger.info("Initializing database service.");
  await database.initialize(cfg);

  // Initialize optional services based on config
  if (cfg.actions.telegramBot) {
    logger.info("Initializing Telegram bot.");
    await telegramBotService.initialize(cfg);

    // Add Telegram logging transport after bot is initialized
    logger.info("Adding Telegram transport to logger.");
    addTelegramTransport(cfg.telegram.logLevel, cfg.telegram.botLogChatId);
  }

  if (cfg.actions.generateFeed) {
    logger.info("Initializing feed service.");
    feedService.initialize(cfg);
  }

  if (cfg.actions.uploadToFtp) {
    logger.info("Initializing FTP service.");
    ftpService.initialize(cfg);
  }

  // Browser and scraper services are only needed for scraping
  if (cfg.actions.scrapeOffers || cfg.actions.scrapeInfo) {
    logger.info("Initializing browser service.");
    await browserService.initialize(cfg);
  }

  if (cfg.actions.scrapeOffers) {
    logger.info("Initializing scraper service.");
    await scraperService.initialize(cfg);
  }

  if (cfg.actions.scrapeInfo) {
    logger.info("Initializing game info service.");
    gameInfoService.initialize(cfg);
  }
}

async function startServices() {
  const cfg = config.get();

  // Start Telegram bot if enabled
  if (cfg.actions.telegramBot) {
    // This starts the bot in the background until stopped
    telegramBotService.start();
  }

  // Start scraper service if enabled
  if (cfg.actions.scrapeOffers) {
    // This starts the scraper service in the background until stopped
    await scraperService.start();
  }
}

/**
 * Gracefully shut down all services
 */
export async function shutdownApp(): Promise<void> {
  // Stop services in reverse order of starting
  logger.info("Stopping services...");
  await telegramBotService.stop();
  await scraperService.stop();

  // Destroy services in reverse order of initialization
  logger.info("Destroying services...");
  //await feedService.destroy();
  //await ftpService.destroy();
  //await gameInfoService.destroy();
  //await scraperService.destroy();
  await browserService.destroy();
  //await telegramBotService.destroy();
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
    await shutdownApp();
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

import { Cron } from "croner";
import { DateTime } from "luxon";

import type { ScraperClass, ScraperInstance } from "@/services/scraper/utils";
import type { Config, NewOffer } from "@/types";

import {
  getEnabledScraperClasses,
  getScraperClassByName,
  getScraperSchedule,
} from "@/services/scraper/utils";
import { logger } from "@/utils/logger";

import { browserService } from "./browser";
import {
  addMissingFieldsToOffer,
  createOffer,
  findOffer,
  touchOffer,
} from "./database/offerRepository";
import {
  cleanQueue,
  getNextDueRun,
  removeScheduledRun,
  scheduleRun,
  updateScrapingRun,
} from "./database/scrapingRunRepository";
import { feedService } from "./feed";
import { ftpService } from "./ftp";
import { gameInfoService } from "./gameinfo";

interface ScrapeResult {
  offers: number;
  newOffers: number;
  modifiedOffers: number;
}

class ScraperService {
  private static instance: ScraperService;
  private executor: NodeJS.Timeout | null = null;
  private config: Config | null = null;
  private isScraping = false;

  private constructor() {
    // Private constructor to prevent instantiation
  }

  public static getInstance(): ScraperService {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!ScraperService.instance) {
      ScraperService.instance = new ScraperService();
    }
    return ScraperService.instance;
  }

  public async initialize(config: Config): Promise<void> {
    this.config = config;
    await this.queueEnabledScrapers();
  }

  public async start(): Promise<void> {
    // Clean leftovers from previous runs
    await cleanQueue();

    this.executor = setInterval(() => {
      void this.processQueue();
    }, 5000); // Check every 5 seconds
  }

  public async stop(): Promise<void> {
    // Prevent this from running the next iteration
    if (this.executor) {
      clearInterval(this.executor);
      this.executor = null;
    }

    // Wait for the current scraping run to finish
    while (this.isScraping) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // TODO: Add a timeout here in case the scraper gets stuck
    }
  }

  async queueEnabledScrapers(forceNow = false): Promise<void> {
    // Step 1 - Get all enabled scrapers
    const enabledScrapers = getEnabledScraperClasses();

    // Step 2 - For each scraper, get the next run time and add it to the database
    for (const scraperClass of enabledScrapers) {
      await this.queueScraper(scraperClass, forceNow);
    }
  }

  /**
   * Queue a specific scraper by name (case-insensitive)
   * @param name The scraper name (e.g., "AmazonGames", "steamloot")
   * @param forceNow If true, queue to run immediately
   * @returns The scraper name if found and queued, null if not found
   */
  async queueScraperByName(name: string, forceNow = false): Promise<string | null> {
    const scraperClass = getScraperClassByName(name);
    if (!scraperClass) {
      return null;
    }

    await this.queueScraper(scraperClass, forceNow);
    return scraperClass.prototype.getScraperName();
  }

  async queueScraper(scraperClass: ScraperClass, forceNow = false): Promise<DateTime> {
    const schedule = getScraperSchedule(scraperClass);

    let nextRun: DateTime | undefined;
    for (const cron of schedule.schedule) {
      const nextExecution = new Cron(cron.schedule, {
        timezone: cron.timezone ?? "UTC",
      }).nextRun();
      if (nextExecution === null) {
        logger.error(`Failed to calculate next execution for ${schedule.name}`);
        continue;
      }
      const nextExecutionDate = forceNow ? DateTime.now() : DateTime.fromJSDate(nextExecution);

      if (!nextRun || nextExecutionDate < nextRun) {
        nextRun = nextExecutionDate;
      }
    }

    if (!nextRun) {
      throw new Error("Failed to calculate next execution time.");
    }

    const dbRun = await scheduleRun({
      scraper: schedule.name,
      scheduled_date: nextRun.toISO(),
    });

    logger.info(`Run #${dbRun.toFixed(0)} (${schedule.name}) is due ${nextRun.toISO()}.`);

    return nextRun;
  }

  async processQueue(): Promise<void> {
    if (!this.config) {
      logger.error("Scraper service not initialized.");
      return;
    }

    if (this.isScraping) {
      logger.verbose("Scraper service is already scraping, skipping check.");
      return;
    }

    this.isScraping = true;
    // Step 1 - Get the next scraper run from the database
    const nextRun = await getNextDueRun();

    if (!nextRun) {
      logger.debug("No scraping run is due at this time.");
      this.isScraping = false;
      return;
    }

    // Step 2 - Find the scraper class for the run
    const scraperClass = getEnabledScraperClasses().find(
      (scraper) => scraper.prototype.getScraperName() === nextRun.scraper,
    );

    if (!scraperClass) {
      logger.warn(
        `No scraper class found for ${nextRun.scraper}. Probably this scraper has been disabled since last start. Removing the queue entry.`,
      );
      await removeScheduledRun(nextRun.id);

      this.isScraping = false;
      return;
    }

    // Step 3 - Update the run to mark it as started
    await updateScrapingRun(nextRun.id, {
      started_date: DateTime.now().toISO(),
    });

    // Step 4 - Spin up the browser if needed
    if (!browserService.isInitialized()) {
      await browserService.initialize(this.config);
    }

    // Step 5 - Initialize the scraper and run it
    try {
      const scraper = new scraperClass(this.config);
      logger.info(`Starting scrape run ${nextRun.id.toFixed(0)} (${nextRun.scraper}).`);
      const scrapeResults = await this.runSingleScrape(scraper);

      // Step 6 - Mark the run as completed
      await updateScrapingRun(nextRun.id, {
        finished_date: DateTime.now().toISO(),
        offers_found: scrapeResults.offers,
        offers_new: scrapeResults.newOffers,
        offers_modified: scrapeResults.modifiedOffers,
      });
    } catch (error) {
      logger.error(
        `Failed to run scraper ${nextRun.scraper}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      // In case of error mark as finished anyways, so we can continue with the next run
      await updateScrapingRun(nextRun.id, {
        finished_date: DateTime.now().toISO(),
      });
    }

    // Step 7 - Queue the next run for this scraper
    await this.queueScraper(scraperClass);

    // Step 8 - Check if we have a queued run. If not, we can spin down the
    // browser to save resources

    if ((await getNextDueRun()) === null) {
      logger.info("No run directly in queue, spinning down browser to save resources.");
      await browserService.destroy();
    }

    // Step 8 - Done, ready for the next run
    this.isScraping = false;
  }

  /**
   * Run scraping for a single scraper and store results
   * @param scraper The scraper instance to run
   * @returns The number of offers found and new offers
   */
  async runSingleScrape(scraper: ScraperInstance): Promise<ScrapeResult> {
    if (!this.config) {
      throw new Error("Scraper service not initialized");
    }

    let offers: NewOffer[];

    try {
      offers = await scraper.scrape();
    } finally {
      // Refresh the context after each scrape to prevent memory leaks
      await browserService.refreshContext();
    }

    // Store offers and track if we found any new ones
    const newOfferIds: number[] = [];
    const modifiedOfferIds: number[] = [];

    for (const newOffer of offers) {
      // Offers that are neither new nor updated just get a new "last seen" date
      // Offers that are new get inserted into the database
      const existingOffer = await findOffer({
        duration: newOffer.duration,
        source: newOffer.source,
        type: newOffer.type,
        platform: newOffer.platform,
        title: newOffer.title,
        validTo: newOffer.valid_to ?? null,
      });

      if (existingOffer) {
        // Touch the offer's last seen date as we have seen it again
        const changed = await addMissingFieldsToOffer(existingOffer.id, newOffer);

        if (changed) {
          modifiedOfferIds.push(existingOffer.id);
          logger.verbose(`Updated offer ${existingOffer.id.toFixed(0)}.`);
        } else {
          await touchOffer(existingOffer.id);
        }

        continue;
      }

      // Create new offer if it doesn't exist
      const newOfferId = await createOffer(newOffer);
      newOfferIds.push(newOfferId);
    }

    logger.info(
      `Completed scrape with ${offers.length.toFixed(0)} offers (${newOfferIds.length.toFixed(0)} new).`,
    );

    if (newOfferIds.length === 0 && modifiedOfferIds.length === 0) {
      return {
        offers: offers.length,
        newOffers: 0,
        modifiedOffers: 0,
      };
    }

    if (this.config.actions.scrapeInfo) {
      for (const gameId of newOfferIds) {
        await gameInfoService.enrichOffer(gameId);
      }
      for (const gameId of modifiedOfferIds) {
        await gameInfoService.enrichOffer(gameId);
      }
    }

    if (this.config.actions.generateFeed) {
      await feedService.updateFeeds();
    }

    if (this.config.actions.generateFeed && this.config.actions.uploadToFtp) {
      await ftpService.uploadEnabledFeedsToServer();
    }

    // Info: Telegram bot checks for new offers to send out every minute on its
    // own, so we don't need to trigger that here.

    return {
      offers: offers.length,
      newOffers: newOfferIds.length,
      modifiedOffers: modifiedOfferIds.length,
    };
  }
}

export const scraperService = ScraperService.getInstance();

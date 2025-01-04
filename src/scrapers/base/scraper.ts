import { resolve } from "node:path";
import { OfferCategory } from "@/types";
import { OfferDuration, OfferType } from "@/types/basic";
import type { OfferSource } from "@/types/basic";
import type { Config } from "@/types/config";
import type { NewOffer } from "@/types/database";
import { ScraperError } from "@/types/errors";
import { cleanCombinedTitle, cleanGameTitle, cleanLootTitle } from "@/utils";
import { logger } from "@/utils/logger";
import { getDataPath } from "@/utils/path";
import { DateTime } from "luxon";
import type { BrowserContext, Locator, Page } from "playwright";
import { errors } from "playwright";

export interface CronConfig {
  schedule: string;
  timezone?: string;
}

/**
 * Base interface for raw offer data
 */
export interface RawOffer {
  title: string;
  url?: string;
  imgUrl?: string;
  validTo?: string;
}

/**
 * Handler for processing offers
 * @template T - Raw offer data type
 */
export interface OfferHandler<T extends RawOffer> {
  locator: Locator;
  readOffer: (element: Locator) => Promise<T | null>;
  normalizeOffer: (rawOffer: T) => Omit<NewOffer, "category">;
}

/**
 * Abstract base class for web scrapers that extract offers from various sources.
 * Implements core scraping functionality and offer processing pipeline.
 *
 * @abstract
 * @template T - Type extending RawOffer that represents the structure of raw offer data
 *
 * @example
 * ```typescript
 * class MyScraper extends BaseScraper<MyRawOffer> {
 *   getSource() { return OfferSource.MY_SOURCE; }
 *   getType() { return OfferType.GAME; }
 *   getDuration() { return OfferDuration.LIMITED; }
 *   getOffersUrl() { return 'https://example.com/offers'; }
 *   getPageReadySelector() { return '.offers-container'; }
 *   getOfferHandlers(page: Page) { return [new MyOfferHandler(page)]; }
 * }
 * ```
 *
 * @property {BrowserContext} context - Playwright browser context for web scraping
 * @property {Config} config - Configuration settings for the scraper
 *
 * @throws {ScraperError} When scraping operations fail
 * @throws {BrowserError} When browser/page operations fail
 *
 * @see {@link RawOffer}
 * @see {@link NewOffer}
 * @see {@link OfferHandler}
 * @see {@link ScraperError}
 * @see {@link BrowserError}
 *
 * @public
 */
export abstract class BaseScraper<T extends RawOffer = RawOffer> {
  constructor(
    protected readonly context: BrowserContext,
    protected readonly config: Config,
  ) {}

  // Abstract methods that must be implemented by concrete scrapers

  /**
   * Returns the source platform/website where offers are being scraped from.
   * This identifies where the offers originate.
   * @returns {OfferSource} The source platform identifier
   */
  abstract getSource(): OfferSource;

  /**
   * Returns the type of offers this scraper is looking for.
   * This categorizes what kind of offers are being scraped (for now games or loot).
   * @returns {OfferType} The type of offers to scrape
   */
  abstract getType(): OfferType;

  /**
   * Returns the expected duration of offers this scraper handles.
   * This indicates the timeframe that offers are typically available for.
   * @returns {OfferDuration} The expected duration of offers
   */
  abstract getDuration(): OfferDuration;

  /**
   * Returns the URL of the webpage where offers are listed.
   * This is the entry point for the scraper to begin extracting offers.
   * @returns {string} The URL to scrape offers from
   */
  abstract getOffersUrl(): string;

  /**
   * Returns a CSS selector that indicates when the page is ready for scraping.
   * The scraper will wait for this selector to be present before proceeding.
   * @returns {string} CSS selector string
   */
  abstract getPageReadySelector(): string;

  /**
   * Returns an array of offer handlers that can extract and process offers from the page.
   * Each handler is responsible for locating and normalizing specific offer elements.
   * @param {Page} page - The Playwright Page object to extract offers from
   * @returns {OfferHandler<T>[]} Array of offer handlers
   */
  abstract getOfferHandlers(page: Page): OfferHandler<T>[];

  // Optional methods that can be overridden

  /**
   * Determines if the scraper should always expect to find offers during scraping.
   * This is used as a validation check - if true and no offers are found, it may indicate a problem.
   * @returns {boolean} Returns true if the scraper should always have offers, false otherwise
   */
  protected shouldAlwaysHaveOffers(): boolean {
    return false;
  }

  /**
   * Get scraper's schedule as cron expressions in UTC
   * Override this to define when the scraper should run
   */
  getSchedule(): CronConfig[] {
    return [{ schedule: "0 * * * * *" }]; // Default: Every hour
  }

  /**
   * Hook method called after the page has been loaded in the browser.
   * This method can be overridden by subclasses to perform custom initialization after page load.
   * The default implementation does nothing.
   *
   * @param _page - The Puppeteer Page object representing the loaded page
   * @returns A Promise that resolves when the hook execution is complete
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async pageLoadedHook(_page: Page): Promise<void> {
    // Default implementation does nothing
  }

  /**
   * Scrapes and processes offers from the source.
   *
   * The scraping process follows these steps:
   * 1. Reads raw offers from source
   * 2. Cleans the offers
   * 3. Removes duplicates
   * 4. Categorizes offers
   * 5. Filters for valid offers
   *
   * @returns {Promise<NewOffer[]>} Array of processed and validated offers
   * @throws {ScraperError} When an error occurs during scraping
   *
   * @example
   * const scraper = new Scraper();
   * const offers = await scraper.scrape();
   */
  public async scrape(): Promise<NewOffer[]> {
    logger.info(
      `Analyzing ${this.getSource()} for offers: ${this.getType()} / ${this.getDuration()}`,
    );

    try {
      const offers = await this.readOffers();
      const cleanedOffers = this.cleanOffers(offers);
      const uniqueOffers = this.deduplicateOffers(cleanedOffers);
      const categorizedOffers = this.categorizeOffers(uniqueOffers);
      const filteredOffers = this.filterForValidOffers(categorizedOffers);

      const titles = filteredOffers.map((o) => o.title).join(", ");
      if (filteredOffers.length > 0) {
        logger.info(
          `Found ${filteredOffers.length.toFixed()} offers: ${titles}`,
        );
      } else if (this.shouldAlwaysHaveOffers()) {
        logger.warn(
          "Found no offers, even though there should be at least one.",
        );
      } else {
        logger.info("No offers found. Probably there are none.");
      }

      return filteredOffers;
    } catch (error) {
      logger.error(
        `Failed to scrape ${this.getSource()}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  private async takeScreenshot(page: Page, suffix = ""): Promise<void> {
    try {
      const filename = resolve(
        getDataPath(),
        `${this.getSource().toLowerCase()}_${DateTime.now().toFormat("yyyyMMdd_HHmmss")}_${suffix}.png`,
      );

      await page.screenshot({
        path: filename,
        fullPage: true,
      });
    } catch (error) {
      logger.error(
        `Failed to take screenshot: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Reads and processes offers from a web page.
   *
   * This method performs the following steps:
   * 1. Creates a new page in the browser context
   * 2. Navigates to the offers URL
   * 3. Waits for the page to be ready for parsing
   * 4. Processes each offer handler to extract offer information
   * 5. Closes the page when done
   *
   * @returns {Promise<Omit<NewOffer, "category">[]>} A promise that resolves to an array of offers without category information
   * @throws {BrowserError} When the page doesn't become ready for parsing within the timeout period
   * @throws {ScraperError} When no offers can be found on the page
   * @async
   * @protected
   */
  protected async readOffers(): Promise<Omit<NewOffer, "category">[]> {
    const offers: Omit<NewOffer, "category">[] = [];
    let page: Page | null = null;

    try {
      page = await this.context.newPage();

      await page.goto(this.getOffersUrl(), { timeout: 30000 });
      await page.waitForSelector(this.getPageReadySelector(), {
        timeout: 10000,
      });
      await this.pageLoadedHook(page);

      for (const handler of this.getOfferHandlers(page)) {
        const elements = await handler.locator.all().catch(() => {
          throw new ScraperError(
            "Couldn't find any offers",
            this.getSource(),
            this.getOffersUrl(),
          );
        });

        for (const element of elements) {
          try {
            // TODO: Do we need readOffer and normalizeOffer or can we merge them?
            const rawOffer = await handler.readOffer(element);
            if (!rawOffer) continue;
            const normalizedOffer = handler.normalizeOffer(rawOffer);
            offers.push(normalizedOffer);
          } catch (error) {
            // Log and skip offer if processing fails
            logger.error(
              `Failed to process offer: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      }

      if (offers.length === 0) {
        if (this.shouldAlwaysHaveOffers()) {
          await this.takeScreenshot(page, "no_offers");
          logger.warn(
            "Found no offers, even though there should be at least one.",
          );
        } else {
          logger.info("No offers found. Probably there are none.");
        }
      }
    } catch (error) {
      // Try to take a screenshot to help diagnose the problem
      try {
        if (page === null) {
          logger.error("Failed to create a new page. Can't take a screenshot.");
          return [];
        }
        if (error instanceof errors.TimeoutError) {
          await this.takeScreenshot(page, "browser_error");
        } else {
          await this.takeScreenshot(page, "other_error");
        }
      } catch {
        // Ignore errors while taking a screenshot
      }
    } finally {
      await page?.close();
    }

    return offers;
  }

  // Utility methods for offer processing
  protected cleanOffers(
    offers: Omit<NewOffer, "category">[],
  ): Omit<NewOffer, "category">[] {
    // TODO: Since it's refreshed from the rawtext, there is no need to
    // set the title and probable_game_name in the scrapers anymore.

    return offers.map((offer) => {
      const cleaned: Omit<NewOffer, "category"> = {
        ...offer,
        ...(offer.url && { url: offer.url.replace(/\n/g, "").trim() }),
        ...(offer.img_url && {
          img_url: offer.img_url.replace(/\n/g, "").trim(),
        }),
      };

      // Game - Set title and probable_game_name from rawtext
      if (offer.type === OfferType.GAME && offer.rawtext !== undefined) {
        const parsed = JSON.parse(offer.rawtext) as Record<string, unknown>;

        if (
          "title" in parsed &&
          typeof parsed.title === "string" &&
          cleaned.title !== parsed.title
        ) {
          const newTitle = cleanGameTitle(parsed.title);

          logger.verbose(
            `Updating game title and probable game name from ${cleaned.title} to ${newTitle}`,
          );
          cleaned.title = newTitle;
          cleaned.probable_game_name = newTitle;
        }

        return cleaned;
      }

      // Loot - Set title and probable_game_name
      if (offer.rawtext !== undefined) {
        const parsed = JSON.parse(offer.rawtext) as Record<string, unknown>;

        let newProbableGameName = "";
        let newOfferTitle = "";

        if (
          "gametitle" in parsed &&
          "title" in parsed &&
          typeof parsed.gametitle === "string" &&
          typeof parsed.title === "string"
        ) {
          newProbableGameName = cleanGameTitle(parsed.gametitle);
          newOfferTitle = `${newProbableGameName} - ${cleanLootTitle(parsed.title)}`;
        } else if ("title" in parsed && typeof parsed.title === "string") {
          [newProbableGameName, newOfferTitle] = cleanCombinedTitle(
            parsed.title,
          );
        }

        if (
          newProbableGameName &&
          newProbableGameName !== offer.probable_game_name
        ) {
          logger.verbose(
            `Updating loot probable game name from ${offer.probable_game_name} to ${newProbableGameName}`,
          );
          cleaned.probable_game_name = newProbableGameName;
        }

        if (newOfferTitle && newOfferTitle !== offer.title) {
          logger.verbose(
            `Updating loot title from ${offer.title} to ${newOfferTitle}`,
          );
          cleaned.title = newOfferTitle;
        }
      }

      return cleaned;
    });
  }

  protected deduplicateOffers(
    offers: Omit<NewOffer, "category">[],
  ): Omit<NewOffer, "category">[] {
    const titles = new Set<string>();
    return offers.filter((offer) => {
      if (titles.has(offer.title)) {
        logger.debug(`Duplicate offer: ${offer.title}`);
        return false;
      }
      titles.add(offer.title);
      return true;
    });
  }

  /**
   * Categorize offers by title (demo, etc.).
   *
   * @param offers
   * @returns
   */
  protected categorizeOffers(offers: Omit<NewOffer, "category">[]): NewOffer[] {
    return offers.map((offer) => {
      const categorized: NewOffer = { ...offer, category: OfferCategory.VALID };

      if (this.isDemo(offer.title)) {
        categorized.category = OfferCategory.DEMO;
      } else if (this.isPrerelease(offer.title)) {
        categorized.category = OfferCategory.PRERELEASE;
      } else if (
        offer.valid_to &&
        this.isFakeAlways(DateTime.fromISO(offer.valid_to).toJSDate())
      ) {
        categorized.duration = OfferDuration.ALWAYS;
      }

      return categorized;
    });
  }

  /**
   * Only keep offers that are valid.
   *
   * @param offers
   * @returns
   */
  protected filterForValidOffers(offers: NewOffer[]): NewOffer[] {
    return offers.filter(
      (offer) =>
        !offer.category || offer.category === OfferCategory.VALID.valueOf(),
    );
  }

  /**
   * Check if the given title is a demo.
   *
   * Catches titles like:
   * - "Demo: Title"
   * - "Title (Demo)"
   * - "Title Demo"
   * - "Title Demo (Version)",
   * - "Title Demo (Great game)",
   * - "Title Demo Version"
   *
   * @param title
   * @returns
   */
  protected isDemo(title: string): boolean {
    const demoRegex = /^[\W]?demo[\W]|\Wdemo\W?((.*version.*)|(\(.*\)))?$/i;
    const teaserRegex =
      /^[\W]?teaser[\W]|\Wteaser\W?((.*version.*)|(\(.*\)))?$/i;
    return demoRegex.test(title) || teaserRegex.test(title);
  }

  /**
   * Check if the given title is an alpha or beta version.
   *
   * Catches titles like:
   * - "Alpha: Title"
   * - "Title (Alpha)"
   * - "Title Alpha"
   * - "Title Alpha (Version)",
   * - "Title Alpha (Great game)",
   * - "Title Alpha Version"
   *
   * @param title
   * @returns
   */
  protected isPrerelease(title: string): boolean {
    const patterns = [
      /^[\W]?alpha[\W]|\Walpha\W?((.*version.*)|(\(.*\)))?$/i,
      /^[\W]?beta[\W]|\Wbeta\W?((.*version.*)|(\(.*\)))?$/i,
      /^[\W]?early access[\W]|\Wearly access\W?((.*version.*)|(\(.*\)))?$/i,
    ];
    return (
      patterns.some((pattern) => pattern.test(title)) ||
      title.includes("Playable Teaser") // Sometimes used by GOG
    );
  }

  /**
   * Check if the offer is "always" valid. That means the end date is
   * unreasonably far in the future (100 days or more).
   *
   * @param validTo
   * @returns
   */
  protected isFakeAlways(validTo: Date): boolean {
    const futureDate = DateTime.now().plus({ days: 100 });
    return DateTime.fromJSDate(validTo) > futureDate;
  }

  /**
   * Scroll down to the bottom of the given element.
   * Useful for pages with infinite scrolling.
   *
   * @param page
   * @param elementId
   */
  protected async scrollElementToBottom(
    page: Page,
    elementId: string,
  ): Promise<void> {
    const scrollAmount: number = await page.evaluate(
      `document.getElementById("${elementId}").clientHeight * 0.8`,
    );
    // Get scroll height
    let position: number = await page.evaluate(
      `document.getElementById("${elementId}").scrollTop`,
    );
    let scrollCount = 0;

    // Scroll for max. 100 times.
    // If it doesn't reach the bottom befor,e something is wrong.
    while (scrollCount < 100) {
      // Scroll down to bottom
      await page.evaluate(
        `document.getElementById("${elementId}").scrollTo(0, ${(position + scrollAmount).toFixed()})`,
      );

      // Calculate new scroll height and compare with last scroll height
      const newPosition: number = await page.evaluate(
        `document.getElementById("${elementId}").scrollTop`,
      );

      if (newPosition === position) break;
      position = newPosition;
      scrollCount++;

      // Wait 1 second before next scroll
      await page.waitForTimeout(1000);
    }

    // Wait 1 second after scrolling to trigger any lazy loading
    await page.waitForTimeout(1000);
  }

  /**
   * Scroll down to the bottom of the current page.
   * Useful for pages with infinite scrolling.
   *
   * @param page
   */
  protected async scrollPageToBottom(page: Page): Promise<void> {
    // Get scroll height
    let height = await page.evaluate("document.body.scrollHeight");
    let scrollCount = 0;

    // Scroll for max. 100 times.
    // If it doesn't reach the bottom befor,e something is wrong.
    while (scrollCount < 100) {
      // Wait to load page. We do this first to give the page time for the initial load.
      await page.waitForTimeout(1000);
      // Scroll down to bottom
      await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");

      // Calculate new scroll height and compare with last scroll height
      const newHeight = await page.evaluate("document.body.scrollHeight");
      if (newHeight === height) break;
      height = newHeight;
      scrollCount++;
    }

    // Final mouse wheel movements (up and down) to trigger any lazy loading
    await page.waitForTimeout(1000);
    await page.mouse.wheel(0, -100);

    await page.waitForTimeout(1000);
    await page.mouse.wheel(0, 100);

    // One final wait so the content may load
    await page.waitForTimeout(1000);
  }
}

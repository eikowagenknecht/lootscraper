import type { BrowserContext, Locator, Page } from "playwright";

import { DateTime } from "luxon";
import { errors } from "playwright";

import type { OfferPlatform, OfferSource, OfferType } from "@/types";
import type { Config } from "@/types/config";
import type { NewOffer } from "@/types/database";

import { browserService } from "@/services/browser";
import { takeScreenshot } from "@/services/browser/utils";
import { OfferCategory, OfferDuration } from "@/types";
import { ScraperError } from "@/types/errors";
import { logger } from "@/utils/logger";

export interface CronConfig {
  schedule: string;
  timezone?: string;
}

/**
 * Handler for processing offers
 * @template T - Raw offer data type
 */
interface OfferHandler {
  locator: string;
  readOffer: (element: Locator) => Promise<Omit<NewOffer, "category"> | null>;
}

/**
 * Abstract base class for web scrapers that extract offers from various sources.
 * Implements core scraping functionality and offer processing pipeline.
 * @template T - Type extending RawOffer that represents the structure of raw offer data
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
 * @throws {ScraperError} When scraping operations fail
 * @throws {BrowserError} When browser/page operations fail
 * @see {@link RawOffer}
 * @see {@link NewOffer}
 * @see {@link OfferHandler}
 * @see {@link ScraperError}
 * @see {@link BrowserError}
 */
export abstract class BaseScraper {
  protected context: BrowserContext | undefined;

  constructor(protected readonly config: Config) {}

  // Abstract methods that must be implemented by concrete scrapers

  /**
   * Returns the name of the scraper.
   * This is used for config and logging purposes.
   */
  abstract getScraperName(): string;

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
   * Returns the platform of the games this scraper is looking for.
   * @returns {OfferPlatform} The platform of the games to scrape
   */
  abstract getPlatform(): OfferPlatform;

  // Optional methods that can be overridden

  /**
   * Determines if the scraper should always expect to find offers during scraping.
   * This is used as a validation check - if true and no offers are found, it may indicate a problem.
   * @returns true if the scraper should always have offers, false otherwise
   */
  protected shouldAlwaysHaveOffers(): boolean {
    return false;
  }

  /**
   * Get scraper's schedule as cron expressions in UTC.
   * Override this to define when the scraper should run.
   * @returns Array of cron expressions.
   */
  getSchedule(): CronConfig[] {
    return [{ schedule: "0 * * * * *" }]; // Default: Every hour
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
   * @returns Array of processed and validated offers
   * @throws {ScraperError} When an error occurs during scraping
   * @example
   * const scraper = new Scraper();
   * const offers = await scraper.scrape();
   */
  public async scrape(): Promise<NewOffer[]> {
    try {
      const offers = await this.readOffers();
      this.logFoundOffers(offers);
      const cleanedOffers = this.cleanOffers(offers);
      const uniqueOffers = this.deduplicateOffers(cleanedOffers);
      const categorizedOffers = this.categorizeOffers(uniqueOffers);
      const filteredOffers = this.filterForValidOffers(categorizedOffers);

      return filteredOffers;
    } catch (error) {
      logger.error(
        `Error in scraper ${this.getScraperName()}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  abstract readOffers(): Promise<Omit<NewOffer, "category">[]>;

  private logFoundOffers(offers: Omit<NewOffer, "category">[]): void {
    if (offers.length === 0) {
      if (this.shouldAlwaysHaveOffers()) {
        logger.warn(
          `${this.getScraperName()}: Found no offers, even though there should be at least one.`,
        );
      } else {
        logger.info(`${this.getScraperName()}: No offers found. Probably there are none.`);
      }

      return;
    }

    const titles = offers.map((o) => o.title).join(", ");
    logger.debug(
      `${this.getScraperName()}: Found ${offers.length.toFixed(0)} offers (raw titles): ${titles}`,
    );
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
   * @param options
   * The options object
   * @param options.offersUrl
   * The URL of the page to scrape offers from.
   * This is the entry point for the scraper to begin extracting offers.
   * @param options.pageReadySelector
   * CSS selector indicating when the page is ready for parsing.
   * The scraper will wait for this selector to be present before proceeding.
   * @param options.offerHandlers
   * Array of offer handlers that can extract and process offers from the page.
   * Each handler is responsible for locating and normalizing specific offer elements.
   * @param options.pageLoadedHook
   * Hook method called after the page has been loaded in the browser.
   * @returns
   * A promise that resolves to an array of offers without category information.
   * @throws {BrowserError}
   * When the page doesn't become ready for parsing within the timeout period.
   * @throws {ScraperError}
   * When no offers can be found on the page.
   * @async
   */
  protected async readWebOffers({
    offersUrl,
    offerHandlers,
    pageReadySelector,
    pageLoadedHook,
  }: {
    offersUrl: string;
    offerHandlers: OfferHandler[];
    pageReadySelector: string;
    pageLoadedHook?: (page: Page) => Promise<void>;
  }): Promise<Omit<NewOffer, "category">[]> {
    this.context = browserService.getContext();

    const offers: Omit<NewOffer, "category">[] = [];
    let page: Page | null = null;

    try {
      page = await this.context.newPage();

      await page.goto(offersUrl, { timeout: 30_000 });
      await page.waitForSelector(pageReadySelector, {
        timeout: 10_000,
      });
      if (pageLoadedHook !== undefined) {
        await pageLoadedHook(page);
      }

      for (const handler of offerHandlers) {
        const elements = await page
          .locator(handler.locator)
          .all()
          .catch(() => {
            throw new ScraperError("Couldn't find any offers", this.getScraperName(), offersUrl);
          });

        for (const element of elements) {
          try {
            const offer = await handler.readOffer(element);
            if (!offer) {
              continue;
            }
            offers.push(offer);
          } catch (error) {
            // Log and skip offer if processing fails
            logger.error(
              `${this.getScraperName()}: Failed to process offer: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      }
    } catch (error) {
      if (page === null) {
        logger.error(
          `${this.getScraperName()}: Failed to create a new page. Can't take a screenshot.`,
        );
        return [];
      }
      if (error instanceof errors.TimeoutError) {
        logger.error(
          `${this.getScraperName()}: Page didn't become ready for parsing within the timeout period.`,
        );
        await takeScreenshot(page, this.getScraperName(), "browser_error");
      } else {
        logger.error(
          `${this.getScraperName()}: Error reading offers: ${error instanceof Error ? error.message : String(error)}`,
        );
        await takeScreenshot(page, this.getScraperName(), "other_error");
      }
    } finally {
      await page?.close();
    }

    return offers;
  }

  // Utility methods for offer processing
  protected cleanOffers(offers: Omit<NewOffer, "category">[]): Omit<NewOffer, "category">[] {
    return offers.map((offer) => {
      const cleaned: Omit<NewOffer, "category"> = {
        ...offer,
        ...(offer.url && { url: offer.url.replaceAll("\n", "").trim() }),
        ...(offer.img_url && {
          img_url: offer.img_url.replaceAll("\n", "").trim(),
        }),
      };

      return cleaned;

      // The following section is commented out because the names should be set
      // in the scraper implementations as those know best how to clean the titles.

      // // Without rawtext, we can't do any more cleaning
      // if (offer.rawtext === undefined) {
      //   return cleaned;
      // }

      // // When the probable_game_name is already set, we don't need to update it
      // if (cleaned.probable_game_name) {
      //   return cleaned;
      // }

      // // Game - Update title and probable_game_name from rawtext
      // if (offer.type === OfferType.GAME) {
      //   const parsed = JSON.parse(offer.rawtext) as Record<string, unknown>;

      //   let newTitle = "";

      //   if ("title" in parsed && typeof parsed.title === "string") {
      //     newTitle = cleanGameTitle(parsed.title);
      //   }

      //   if (
      //     cleaned.title !== newTitle ||
      //     cleaned.probable_game_name !== newTitle
      //   ) {
      //     logger.verbose(
      //       `Updating game title and probable game name from ${cleaned.title} to ${newTitle}`,
      //     );
      //     cleaned.title = newTitle;
      //     cleaned.probable_game_name = newTitle;
      //   }

      //   return cleaned;
      // }

      // // Loot - Set title and probable_game_name
      // const parsed = JSON.parse(offer.rawtext) as Record<string, unknown>;

      // let newProbableGameName = "";
      // let newOfferTitle = "";

      // if (
      //   "gametitle" in parsed &&
      //   "title" in parsed &&
      //   typeof parsed.gametitle === "string" &&
      //   typeof parsed.title === "string"
      // ) {
      //   newProbableGameName = cleanGameTitle(parsed.gametitle);
      //   newOfferTitle = `${newProbableGameName} - ${cleanLootTitle(parsed.title)}`;
      // } else if ("title" in parsed && typeof parsed.title === "string") {
      //   [newProbableGameName, newOfferTitle] = cleanCombinedTitle(parsed.title);
      // }

      // if (cleaned.probable_game_name !== newProbableGameName) {
      //   logger.verbose(
      //     `Updating loot probable game name from ${offer.probable_game_name} to ${newProbableGameName}`,
      //   );
      //   cleaned.probable_game_name = newProbableGameName;
      // }

      // if (cleaned.title !== newOfferTitle) {
      //   logger.verbose(
      //     `Updating loot title from ${offer.title} to ${newOfferTitle}`,
      //   );
      //   cleaned.title = newOfferTitle;
      // }

      // return cleaned;
    });
  }

  protected deduplicateOffers(offers: Omit<NewOffer, "category">[]): Omit<NewOffer, "category">[] {
    const titles = new Set<string>();
    return offers.filter((offer) => {
      if (titles.has(offer.title)) {
        logger.debug(`${this.getScraperName()}: Duplicate offer: ${offer.title}`);
        return false;
      }
      titles.add(offer.title);
      return true;
    });
  }

  /**
   * Categorize offers by title (demo, etc.).
   * @param offers The offers to categorize
   * @returns The categorized offers
   */
  protected categorizeOffers(offers: Omit<NewOffer, "category">[]): NewOffer[] {
    return offers.map((offer) => {
      const categorized: NewOffer = { ...offer, category: OfferCategory.VALID };

      if (this.isDemo(offer.title)) {
        categorized.category = OfferCategory.DEMO;
      } else if (this.isPrerelease(offer.title)) {
        categorized.category = OfferCategory.PRERELEASE;
      } else if (offer.valid_to && this.isFakeAlways(DateTime.fromISO(offer.valid_to))) {
        categorized.duration = OfferDuration.ALWAYS;
      }

      return categorized;
    });
  }

  /**
   * Only keep offers that are valid.
   * @param offers The offers to filter
   * @returns The valid offers
   */
  protected filterForValidOffers(offers: NewOffer[]): NewOffer[] {
    return offers.filter(
      (offer) => !offer.category || offer.category === OfferCategory.VALID.valueOf(),
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
   * @param title The title to check
   * @returns true if the title is a demo, false otherwise
   */
  protected isDemo(title: string): boolean {
    const demoRegex = /^[\W]?demo[\W]|\Wdemo\W?((.*version.*)|(\(.*\)))?$/i;
    const teaserRegex = /^[\W]?teaser[\W]|\Wteaser\W?((.*version.*)|(\(.*\)))?$/i;
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
   * @param title The title to check
   * @returns true if the title is a prerelease, false otherwise
   */
  protected isPrerelease(title: string): boolean {
    const patterns = [
      /^[\W]?alpha[\W]|\Walpha\W?((.*version.*)|(\(.*\)))?$/i,
      /^[\W]?beta[\W]|\Wbeta\W?((.*version.*)|(\(.*\)))?$/i,
      /^[\W]?early access[\W]|\Wearly access\W?((.*version.*)|(\(.*\)))?$/i,
    ];
    return (
      patterns.some((pattern) => pattern.test(title)) || title.includes("Playable Teaser") // Sometimes used by GOG
    );
  }

  /**
   * Check if the offer is "always" valid. That means the end date is
   * unreasonably far in the future (100 days or more).
   * @param validTo The end date of the offer
   * @returns true if the offer is always valid, false otherwise
   */
  protected isFakeAlways(validTo: DateTime): boolean {
    const futureDate = DateTime.now().plus({ days: 100 });
    return validTo > futureDate;
  }

  /**
   * Scroll down to the bottom of the given element.
   * Useful for pages with infinite scrolling.
   * @param page The Playwright page to scroll
   * @param elementId The ID of the element to scroll
   */
  protected async scrollElementToBottom(page: Page, elementId: string): Promise<void> {
    const scrollAmount: number = await page.evaluate(
      `document.getElementById("${elementId}").clientHeight * 0.8`,
    );
    // Get scroll height
    let position: number = await page.evaluate(`document.getElementById("${elementId}").scrollTop`);
    let scrollCount = 0;

    // Scroll for max. 100 times.
    // If it doesn't reach the bottom befor,e something is wrong.
    while (scrollCount < 100) {
      // Scroll down to bottom
      await page.evaluate(
        `document.getElementById("${elementId}").scrollTo(0, ${(position + scrollAmount).toFixed(0)})`,
      );

      // Calculate new scroll height and compare with last scroll height
      const newPosition: number = await page.evaluate(
        `document.getElementById("${elementId}").scrollTop`,
      );

      if (newPosition === position) {
        break;
      }
      position = newPosition;
      scrollCount++;

      // Wait 1 second before next scroll
      await page.waitForTimeout(1000);
    }

    // Wait 1 second after scrolling to trigger any lazy loading
    await page.waitForTimeout(1000);
  }
}

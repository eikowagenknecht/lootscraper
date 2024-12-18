import type { Config } from "@/types/config";
import {
  OfferDuration,
  type OfferSource,
  type OfferType,
} from "@/types/config";
import type { NewOffer } from "@/types/database";
import { BrowserError, ScraperError } from "@/types/errors";
import { logger } from "@/utils/logger";
import { DateTime } from "luxon";
import type { BrowserContext, Locator, Page } from "playwright";
import { errors } from "playwright";

export interface CronConfig {
  schedule: string;
  timezone?: string;
}

// Categories for offer classification
export enum Category {
  VALID = "VALID",
  CHEAP = "CHEAP",
  DEMO = "DEMO",
  PRERELEASE = "PRERELEASE",
}

// Base interface for raw offer data
export interface RawOffer {
  title: string;
  url?: string;
  imgUrl?: string;
  validTo?: string;
}

// Handler for processing offers
export interface OfferHandler<T extends RawOffer> {
  locator: Locator;
  readOffer: (element: Locator) => Promise<T | null>;
  normalizeOffer: (rawOffer: T) => Omit<NewOffer, "category">;
}

export abstract class BaseScraper<T extends RawOffer = RawOffer> {
  protected logger = logger;

  constructor(
    protected readonly context: BrowserContext,
    protected readonly config: Config,
  ) {}

  // Abstract methods that must be implemented by concrete scrapers
  abstract getSource(): OfferSource;
  abstract getType(): OfferType;
  abstract getDuration(): OfferDuration;
  abstract getOffersUrl(): string;
  abstract getPageReadySelector(): string;
  abstract getOfferHandlers(page: Page): OfferHandler<T>[];

  // Optional methods that can be overridden
  protected offersExpected(): boolean {
    return false;
  }

  /**
   * Get scraper's schedule as cron expressions in UTC
   * Override this to define when the scraper should run
   */
  getSchedule(): CronConfig[] {
    return [{ schedule: "0 * * * * *" }]; // Default: Every hour
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async pageLoadedHook(_page: Page): Promise<void> {
    // Default implementation does nothing
  }

  public async scrape(): Promise<NewOffer[]> {
    this.logger.info(
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
        this.logger.info(
          `Found ${filteredOffers.length.toFixed()} offers: ${titles}`,
        );
      } else if (this.offersExpected()) {
        this.logger.error(
          "Found no offers, even though there should be at least one.",
        );
      } else {
        this.logger.info("No offers found.");
      }

      return filteredOffers;
    } catch (error) {
      if (error instanceof Error) {
        throw new ScraperError(error.message, this.getSource());
      }
      throw error;
    }
  }

  protected async readOffers(): Promise<Omit<NewOffer, "category">[]> {
    const offers: Omit<NewOffer, "category">[] = [];
    let page: Page | null = null;

    try {
      page = await this.context.newPage();
      await page.goto(this.getOffersUrl(), { timeout: 30000 });

      try {
        await page.waitForSelector(this.getPageReadySelector(), {
          timeout: 10000,
        });
        await this.pageLoadedHook(page);
      } catch (error) {
        if (error instanceof errors.TimeoutError) {
          throw new BrowserError(
            "Page didn't get ready to be parsed",
            this.getOffersUrl(),
          );
        }
        throw error;
      }

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
            const rawOffer = await handler.readOffer(element);
            if (!rawOffer) continue;

            const normalizedOffer = handler.normalizeOffer(rawOffer);
            offers.push(normalizedOffer);
          } catch (error) {
            this.logger.error(
              `Failed to process offer: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
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
    return offers.map((offer) => {
      const cleaned = { ...offer };

      if (cleaned.url) {
        cleaned.url = cleaned.url.replace(/\n/g, "").trim();
      }

      if (cleaned.img_url) {
        cleaned.img_url = cleaned.img_url.replace(/\n/g, "").trim();
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
        this.logger.debug(`Duplicate offer: ${offer.title}`);
        return false;
      }
      titles.add(offer.title);
      return true;
    });
  }

  protected categorizeOffers(offers: Omit<NewOffer, "category">[]): NewOffer[] {
    return offers.map((offer) => {
      const categorized: NewOffer = { ...offer, category: Category.VALID };

      if (this.isDemo(offer.title)) {
        categorized.category = Category.DEMO;
      } else if (this.isPrerelease(offer.title)) {
        categorized.category = Category.PRERELEASE;
      } else if (
        offer.valid_to &&
        this.isFakeAlways(DateTime.fromISO(offer.valid_to).toJSDate())
      ) {
        categorized.duration = OfferDuration.ALWAYS;
      }

      return categorized;
    });
  }

  protected filterForValidOffers(offers: NewOffer[]): NewOffer[] {
    return offers.filter(
      (offer) => !offer.category || offer.category === Category.VALID.valueOf(),
    );
  }

  // Utility methods for offer classification
  protected isDemo(title: string): boolean {
    const demoRegex = /^[\W]?demo[\W]|\Wdemo\W?((.*version.*)|(\(.*\)))?$/i;
    const teaserRegex =
      /^[\W]?teaser[\W]|\Wteaser\W?((.*version.*)|(\(.*\)))?$/i;
    return demoRegex.test(title) || teaserRegex.test(title);
  }

  protected isPrerelease(title: string): boolean {
    const patterns = [
      /^[\W]?alpha[\W]|\Walpha\W?((.*version.*)|(\(.*\)))?$/i,
      /^[\W]?beta[\W]|\Wbeta\W?((.*version.*)|(\(.*\)))?$/i,
      /^[\W]?early access[\W]|\Wearly access\W?((.*version.*)|(\(.*\)))?$/i,
    ];
    return (
      patterns.some((pattern) => pattern.test(title)) ||
      title.includes("Playable Teaser")
    );
  }

  protected isFakeAlways(validTo: Date): boolean {
    const futureDate = DateTime.now().plus({ days: 100 });
    return DateTime.fromJSDate(validTo) > futureDate;
  }
  // Utility methods for page scrolling
  protected async scrollElementToBottom(
    page: Page,
    elementId: string,
  ): Promise<void> {
    const scrollAmount: number = await page.evaluate(
      `document.getElementById("${elementId}").clientHeight * 0.8`,
    );
    let position: number = await page.evaluate(
      `document.getElementById("${elementId}").scrollTop`,
    );
    let scrollCount = 0;

    while (scrollCount < 100) {
      await page.evaluate(
        `document.getElementById("${elementId}").scrollTo(0, ${(position + scrollAmount).toFixed()})`,
      );
      const newPosition: number = await page.evaluate(
        `document.getElementById("${elementId}").scrollTop`,
      );

      if (newPosition === position) break;
      position = newPosition;
      scrollCount++;

      await page.waitForTimeout(1000); // SCROLL_PAUSE_SECONDS
    }

    await page.waitForTimeout(1000);
  }

  protected async scrollPageToBottom(page: Page): Promise<void> {
    let height = await page.evaluate("document.body.scrollHeight");
    let scrollCount = 0;

    while (scrollCount < 100) {
      await page.waitForTimeout(1000);
      await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");

      const newHeight = await page.evaluate("document.body.scrollHeight");
      if (newHeight === height) break;
      height = newHeight;
      scrollCount++;
    }

    // Final mouse wheel movements to trigger any lazy loading
    await page.waitForTimeout(1000);
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(1000);
    await page.mouse.wheel(0, 100);
    await page.waitForTimeout(1000);
  }
}

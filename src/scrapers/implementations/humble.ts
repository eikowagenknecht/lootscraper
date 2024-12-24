import { OfferCategory } from "@/types";
import { OfferDuration, OfferSource, OfferType } from "@/types/config";
import type { NewOffer } from "@/types/database";
import { logger } from "@/utils/logger";
import { DateTime } from "luxon";
import type { Locator, Page } from "playwright";
import {
  BaseScraper,
  type CronConfig,
  type OfferHandler,
  type RawOffer,
} from "../base/scraper";

const BASE_URL = "https://humblebundle.com";
const SEARCH_URL = `${BASE_URL}/store/search`;
const SEARCH_PARAMS = new URLSearchParams({
  sort: "discount",
  filter: "onsale",
});

interface HumbleRawOffer extends RawOffer {
  validForMinutes?: number;
  originalPrice?: number;
}

export class HumbleGamesScraper extends BaseScraper<HumbleRawOffer> {
  override getSchedule(): CronConfig[] {
    return [
      { schedule: "0 0 */3 * * *" }, // Every 3 hours
    ];
  }

  getSource(): OfferSource {
    return OfferSource.HUMBLE;
  }

  getType(): OfferType {
    return OfferType.GAME;
  }

  getDuration(): OfferDuration {
    return OfferDuration.CLAIMABLE;
  }

  getOffersUrl(): string {
    return `${SEARCH_URL}?${SEARCH_PARAMS.toString()}`;
  }

  getPageReadySelector(): string {
    return "li div.discount-amount";
  }

  getOfferHandlers(page: Page): OfferHandler<HumbleRawOffer>[] {
    return [
      {
        locator: page.locator("li", {
          has: page.locator("div.discount-amount", { hasText: "100" }),
        }),
        readOffer: this.readRawOffer.bind(this),
        normalizeOffer: this.normalizeOffer.bind(this),
      },
    ];
  }

  private async readRawOffer(element: Locator): Promise<HumbleRawOffer | null> {
    try {
      const title = await element.locator("span.entity-title").textContent();
      if (!title) throw new Error("Couldn't find title");

      let url = await element.locator("a").getAttribute("href");
      if (!url) throw new Error(`Couldn't find url for ${title}`);
      if (!url.startsWith("http")) {
        url = BASE_URL + url;
      }

      const imgUrl = await element
        .locator("img.entity-image")
        .getAttribute("src");
      if (!imgUrl) throw new Error(`Couldn't find image for ${title}`);

      const offer: HumbleRawOffer = {
        title,
        url,
        imgUrl,
      };

      await this.addDetails(offer, url);

      return offer;
    } catch (error) {
      logger.error(
        `Failed to read raw offer: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private async addDetails(offer: HumbleRawOffer, url: string): Promise<void> {
    let page = null;
    try {
      page = await this.context.newPage();
      await page.goto(url, { timeout: 30000 });

      await page.waitForSelector(".promo-timer-view .js-days");
      const daysValid = await page
        .locator(".promo-timer-view .js-days")
        .textContent();
      const hoursValid = await page
        .locator(".promo-timer-view .js-hours")
        .textContent();
      const minutesValid = await page
        .locator(".promo-timer-view .js-minutes")
        .textContent();

      if (!daysValid || !hoursValid || !minutesValid) {
        throw new Error(`Couldn't find valid to for ${offer.title}`);
      }

      // Calculate total minutes
      offer.validForMinutes =
        Number.parseInt(daysValid) * 24 * 60 +
        Number.parseInt(hoursValid) * 60 +
        Number.parseInt(minutesValid);

      const originalPrice = await page.locator(".full-price").textContent();

      if (originalPrice) {
        offer.originalPrice = Number.parseFloat(
          originalPrice.replace("€", "").trim(),
        );
      }
    } catch (error) {
      throw new Error(
        `Failed to add offer details: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      await page?.close();
    }
  }

  private normalizeOffer(rawOffer: HumbleRawOffer): NewOffer {
    const rawtext = {
      title: rawOffer.title,
    };

    let validTo: Date | null = null;
    if (typeof rawOffer.validForMinutes === "number") {
      validTo = DateTime.now()
        .plus({ minutes: rawOffer.validForMinutes })
        .toJSDate();
    }

    // Categorize cheap games
    const category =
      rawOffer.originalPrice !== undefined && rawOffer.originalPrice < 1.0
        ? OfferCategory.CHEAP
        : OfferCategory.VALID;

    return {
      source: this.getSource(),
      duration: this.getDuration(),
      type: this.getType(),
      category,
      title: rawOffer.title,
      probable_game_name: rawOffer.title,
      seen_last: DateTime.now().toISO(),
      seen_first: DateTime.now().toISO(),
      ...(validTo ? { valid_to: validTo.toISOString() } : null),
      rawtext: JSON.stringify(rawtext),
      url: rawOffer.url ?? null,
      img_url: rawOffer.imgUrl ?? null,
    };
  }
}

import { DateTime } from "luxon";
import type { Locator } from "playwright";
import { BaseScraper, type CronConfig } from "@/services/scraper/base/scraper";
import { OfferCategory, ScraperError } from "@/types";
import {
  OfferDuration,
  OfferPlatform,
  OfferSource,
  OfferType,
} from "@/types/basic";
import type { NewOffer } from "@/types/database";
import { cleanGameTitle } from "@/utils";
import { logger } from "@/utils/logger";

const BASE_URL = "https://humblebundle.com";
const SEARCH_URL = `${BASE_URL}/store/search`;
const SEARCH_PARAMS = new URLSearchParams({
  sort: "discount",
  filter: "onsale",
});

export class HumbleGamesScraper extends BaseScraper {
  override getSchedule(): CronConfig[] {
    return [
      { schedule: "0 0 */3 * * *" }, // Every 3 hours
    ];
  }

  getScraperName(): string {
    return "HumbleGames";
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

  override getPlatform(): OfferPlatform {
    return OfferPlatform.PC;
  }

  override readOffers(): Promise<Omit<NewOffer, "category">[]> {
    return super.readWebOffers({
      offersUrl: `${SEARCH_URL}?${SEARCH_PARAMS.toString()}`,
      offerHandlers: [
        {
          locator: "li:has(div.discount-amount:text('100'))",
          readOffer: this.readOffer.bind(this),
        },
      ],
      pageReadySelector: "li div.discount-amount",
    });
  }

  private async readOffer(element: Locator): Promise<NewOffer | null> {
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

      const { validForMinutes, originalPrice } = await this.getDetails(url);

      let validTo: DateTime | null = null;
      if (typeof validForMinutes === "number") {
        validTo = DateTime.now().plus({ minutes: validForMinutes });
      }

      // Categorize cheap games
      const category =
        originalPrice !== undefined && originalPrice < 1.0
          ? OfferCategory.CHEAP
          : OfferCategory.VALID;

      return {
        source: this.getSource(),
        duration: this.getDuration(),
        type: this.getType(),
        platform: this.getPlatform(),
        category,
        title: cleanGameTitle(title),
        probable_game_name: cleanGameTitle(title),
        seen_last: DateTime.now().toISO(),
        seen_first: DateTime.now().toISO(),
        ...(validTo && { valid_to: validTo.toISO() }),
        rawtext: JSON.stringify({
          title: title,
        }),
        url: url,
        img_url: imgUrl,
      };
    } catch (error) {
      logger.error(
        `${this.getScraperName()}: Failed to read raw offer: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private async getDetails(url: string) {
    if (!this.context) {
      throw new ScraperError(
        "Browser context not initialized. Call initialize() first.",
        this.getSource(),
      );
    }

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
        throw new Error(`Couldn't find valid to on ${url}.`);
      }

      const result: { validForMinutes: number; originalPrice?: number } = {
        validForMinutes:
          Number.parseInt(daysValid, 10) * 24 * 60 +
          Number.parseInt(hoursValid, 10) * 60 +
          Number.parseInt(minutesValid, 10),
      };

      const originalPrice = await page.locator(".full-price").textContent();

      if (originalPrice) {
        result.originalPrice = Number.parseFloat(
          originalPrice.replace("€", "").trim(),
        );
      }

      return result;
    } catch (error) {
      throw new Error(
        `Failed to add offer details: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      await page?.close();
    }
  }
}

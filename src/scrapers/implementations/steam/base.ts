import { OfferDuration, OfferSource, OfferType } from "@/types/config";
import type { NewOffer } from "@/types/database";
import { logger } from "@/utils/logger";
import { cleanCombinedTitle, cleanGameTitle } from "@/utils/titleCleaner";
import { DateTime } from "luxon";
import type { Locator, Page } from "playwright";
import {
  BaseScraper,
  type CronConfig,
  type OfferHandler,
  type RawOffer,
} from "../../base/scraper";

const BASE_URL = "https://store.steampowered.com";
const SEARCH_URL = `${BASE_URL}/search/`;
const DETAILS_URL = `${BASE_URL}/app/`;

interface SteamRawOffer extends RawOffer {
  appid: number;
  text: string;
}

export abstract class SteamBaseScraper extends BaseScraper<SteamRawOffer> {
  override getSchedule(): CronConfig[] {
    return [
      { schedule: "0 */30 * * * *" }, // Every 30 minutes
    ];
  }

  getSource(): OfferSource {
    return OfferSource.STEAM;
  }

  getDuration(): OfferDuration {
    return OfferDuration.CLAIMABLE;
  }

  abstract getSteamCategory(): number; // Games or DLC

  getOffersUrl(): string {
    const params = new URLSearchParams({
      maxprice: "free",
      category1: this.getSteamCategory().toString(),
      specials: "1",
    });

    return `${SEARCH_URL}?${params.toString()}`;
  }

  getPageReadySelector(): string {
    return "#search_results";
  }

  abstract getValidtextLocator(page: Page): Locator;

  getOfferHandlers(page: Page): OfferHandler<SteamRawOffer>[] {
    return [
      {
        locator: page.locator("#search_results a"),
        readOffer: this.readRawOffer.bind(this),
        normalizeOffer: this.normalizeOffer.bind(this),
      },
    ];
  }

  private async readRawOffer(element: Locator): Promise<SteamRawOffer | null> {
    try {
      const title = await element.locator(".title").textContent();
      if (!title) throw new Error("Couldn't find title");

      const appid = await element.getAttribute("data-ds-appid");
      if (!appid) throw new Error(`Couldn't find appid for ${title}`);

      const url = `${DETAILS_URL}${appid}`;

      let page = null;
      try {
        page = await this.context.newPage();
        await page.goto(url);

        // Handle age verification if present
        await this.skipAgeVerification(page);
        await page.waitForSelector(".game_area_purchase");

        const imgUrl = await page
          .locator(".game_header_image_full")
          .getAttribute("src");
        if (!imgUrl) throw new Error(`Couldn't find image for ${title}`);

        let text: string;
        try {
          // Get the resolved text here because the text_content() contains
          // special characters.
          text = await page
            .locator(".game_purchase_discount_quantity")
            .innerText();
          if (!text) {
            // Sometimes this does not exist, when a game is not free any more
            // or only some DLCs of the game are free.
            logger.warn(`Offer for ${title} seems to be broken, skipping it.`);
            return null;
          }
        } catch {
          logger.warn(
            `Offer for ${title} doesn't contain any free items, skipping it.`,
          );
          return null;
        }

        return {
          title,
          url,
          imgUrl,
          appid: Number.parseInt(appid),
          text,
        };
      } finally {
        await page?.close();
      }
    } catch (error) {
      logger.error(
        `Failed to read raw offer: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private async skipAgeVerification(page: Page): Promise<void> {
    try {
      // Check if age verification is present
      const ageCheck = await page.$("#agecheck_form");
      if (ageCheck) {
        await page.selectOption("#ageYear", "1990");
        await page.click("#view_product_page_btn");
        await page.waitForLoadState("networkidle");
      }
    } catch {
      logger.debug("No age verification needed or failed to handle it");
    }
  }

  protected normalizeOffer(
    rawOffer: SteamRawOffer,
  ): Omit<NewOffer, "category"> {
    const rawtext = {
      title: rawOffer.title,
      appid: rawOffer.appid,
      text: rawOffer.text,
    };

    const now = DateTime.now();
    let validTo: Date | null = null;

    if (rawOffer.text) {
      const dateText = rawOffer.text
        .replace("Free to keep when you get it before ", "")
        .replace(". Some limitations apply. (?)", "");

      let parsedDate: DateTime | null = null;

      try {
        logger.debug(`Parsing date in format for this year: ${dateText}`);

        // Parse Steams "D MMM @ HH:mmAM/PM" format
        parsedDate = DateTime.fromFormat(dateText, "d MMM @ h:mma", {
          zone: "UTC",
        });
        parsedDate = parsedDate.set({ year: now.year });
      } catch {
        logger.debug(`Couldn't parse date, trying next format: ${dateText}`);
      }

      if (!parsedDate) {
        try {
          // Maybe it's next year, so parse Steams "D MMM, YYYY @ HH:mmAM/PM" format instead
          parsedDate = DateTime.fromFormat(dateText, "d MMM, yyyy @ h:mma", {
            zone: "UTC",
          });
        } catch {
          logger.warn(`Couldn't parse date because it's invalid: ${dateText}`);
        }
      }

      if (parsedDate) {
        logger.debug(`Parsed date: ${parsedDate.toISO()}`);
        validTo = parsedDate.toJSDate();
      }
    }

    const probableGameName =
      this.getType() === OfferType.GAME
        ? cleanGameTitle(rawOffer.title)
        : cleanCombinedTitle(rawOffer.title)[0];

    return {
      source: this.getSource(),
      duration: this.getDuration(),
      type: this.getType(),
      title: rawOffer.title,
      probable_game_name: probableGameName,
      seen_last: DateTime.now().toISO(),
      seen_first: DateTime.now().toISO(),
      ...(validTo ? { valid_to: validTo.toISOString() } : null),
      rawtext: JSON.stringify(rawtext),
      url: rawOffer.url ?? null,
      img_url: rawOffer.imgUrl ?? null,
    };
  }
}

import { OfferDuration, OfferSource, OfferType } from "@/types/config";
import type { NewOffer } from "@/types/database";
import { cleanCombinedTitle, cleanGameTitle } from "@/utils/titleCleaner";
import { DateTime } from "luxon";
import type { Locator, Page } from "playwright";
import {
  BaseScraper,
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
  getSource(): OfferSource {
    return OfferSource.STEAM;
  }

  getDuration(): OfferDuration {
    return OfferDuration.CLAIMABLE;
  }

  abstract getSteamCategory(): number;

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

        // Get the resolved text
        let text: string;
        try {
          text = await page
            .locator(".game_purchase_discount_quantity")
            .innerText();
          if (!text) {
            this.logger.warn(
              `Offer for ${title} seems to be broken, skipping it.`,
            );
            return null;
          }
        } catch {
          this.logger.warn(
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
      this.logger.error(
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
      this.logger.debug("No age verification needed or failed to handle it");
    }
  }

  protected normalizeOffer(rawOffer: SteamRawOffer): NewOffer {
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

      try {
        // Parse "DD MMM @ HH:mmAM/PM" format
        let parsedDate = DateTime.fromFormat(dateText, "dd MMM @ h:mma", {
          zone: "UTC",
        });

        // Set the year
        parsedDate = parsedDate.set({ year: now.year });

        // If the date is in the past, add a year
        const yesterday = now.minus({ days: 1 });
        if (parsedDate < yesterday) {
          parsedDate = parsedDate.plus({ years: 1 });
        }

        validTo = parsedDate.toJSDate();
      } catch {
        this.logger.warn(`Couldn't parse date ${dateText}`);
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
      seen_last: new Date().toISOString(),
      seen_first: new Date().toISOString(),
      ...(validTo ? { valid_to: validTo.toISOString() } : null),
      rawtext: JSON.stringify(rawtext),
      url: rawOffer.url ?? null,
      img_url: rawOffer.imgUrl ?? null,
      category: "", // Will be set by categorization
    };
  }
}

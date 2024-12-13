import { OfferDuration, OfferSource, OfferType } from "@/types/config";
import type { NewOffer } from "@/types/database";
import { DateTime } from "luxon";
import type { Locator, Page } from "playwright";
import { BaseScraper, type OfferHandler, type RawOffer } from "../base/scraper";

const BASE_URL = "https://store.ubi.com";
const OFFER_URL = `${BASE_URL}/us/`;

interface UbisoftRawOffer extends RawOffer {
  validTo: string;
}

export class UbisoftGamesScraper extends BaseScraper<UbisoftRawOffer> {
  getSource(): OfferSource {
    return OfferSource.UBISOFT;
  }

  getType(): OfferType {
    return OfferType.GAME;
  }

  getDuration(): OfferDuration {
    return OfferDuration.CLAIMABLE;
  }

  protected override offersExpected(): boolean {
    return false;
  }

  getOffersUrl(): string {
    return OFFER_URL;
  }

  getPageReadySelector(): string {
    return ".wrapper";
  }

  getOfferHandlers(page: Page): OfferHandler<UbisoftRawOffer>[] {
    return [
      {
        locator: page.locator(".c-focus-banner__wrapper"),
        readOffer: this.readRawOffer.bind(this),
        normalizeOffer: this.normalizeOffer.bind(this),
      },
    ];
  }

  private async readRawOffer(
    element: Locator,
  ): Promise<UbisoftRawOffer | null> {
    try {
      // Scroll element into view to load img url
      await element.scrollIntoViewIfNeeded();

      // Format: "Get <Assassin's Creed> for free!"
      const title = await element
        .locator(".c-focus-banner__title")
        .textContent();
      if (!title) throw new Error("Couldn't find title");

      // Filter out various other promotions
      const compareTitle = title.toLowerCase();
      if (
        !compareTitle.startsWith("get ") ||
        !compareTitle.endsWith(" for free!")
      ) {
        return null;
      }

      // Format: "Offer ends <January 23, 2023 at 3PM UTC>"
      const validTo = await element
        .locator(".c-focus-banner__legal-line")
        .innerText();
      if (!validTo) throw new Error(`Couldn't find valid to for ${title}`);

      let url = await element.locator("a.button").getAttribute("href");
      if (!url) throw new Error(`Couldn't find url for ${title}`);
      if (!url.startsWith("http")) {
        url = BASE_URL + url;
      }

      let imgUrl = await element.locator("img").getAttribute("src");
      if (!imgUrl) throw new Error(`Couldn't find image for ${title}`);
      if (!imgUrl.startsWith("http")) {
        imgUrl = BASE_URL + imgUrl;
      }

      return {
        title,
        validTo,
        url,
        imgUrl,
      };
    } catch (error) {
      this.logger.error(
        `Failed to read raw offer: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private normalizeOffer(rawOffer: UbisoftRawOffer): NewOffer {
    const rawtext = {
      title: rawOffer.title,
      enddate: rawOffer.validTo,
    };

    // Clean up title
    const title = rawOffer.title
      .replace(/^Get /, "")
      .replace(/ for FREE!$/, "");

    // Clean up date
    const validToText = rawOffer.validTo
      .replace(/^Offer valid until /, "")
      .replace(/^Offer ends /, "")
      .replace(/ UTC\.$/, "");

    let validTo: Date | null = null;

    // Try standard format first: "January 23, 2023 at 3PM"
    try {
      validTo = DateTime.fromFormat(validToText, "MMMM d, yyyy 'at' ha", {
        zone: "UTC",
      }).toJSDate();
    } catch (error) {
      this.logger.debug(
        `Failed to parse date in standard format: ${error instanceof Error ? error.message : String(error)}`,
      );

      // Try alternate format: "January 23 at 2023 at 3PM"
      try {
        validTo = DateTime.fromFormat(validToText, "MMMM d 'at' yyyy 'at' ha", {
          zone: "UTC",
        }).toJSDate();
      } catch (error) {
        this.logger.error(
          `Failed to parse date in alternate format: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return {
      source: this.getSource(),
      duration: this.getDuration(),
      type: this.getType(),
      title,
      probable_game_name: title,
      seen_last: DateTime.now().toISO(),
      seen_first: DateTime.now().toISO(),
      ...(validTo ? { valid_to: validTo.toISOString() } : null),
      rawtext: JSON.stringify(rawtext),
      url: rawOffer.url ?? null,
      img_url: rawOffer.imgUrl ?? null,
      category: "", // Will be set by categorization
    };
  }
}

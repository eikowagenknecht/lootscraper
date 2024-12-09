import { OfferDuration, OfferSource, OfferType } from "@/types/config";
import type { NewOffer } from "@/types/database";
import { DateTime } from "luxon";
import type { Locator, Page } from "playwright";
import { BaseScraper, type OfferHandler, type RawOffer } from "../base/scraper";

const BASE_URL = "https://store.epicgames.com";
const OFFER_URL = `${BASE_URL}/en-US/`;

interface EpicRawOffer extends RawOffer {
  validTo: string; // ISO date string
}

export class EpicGamesScraper extends BaseScraper<EpicRawOffer> {
  getSource(): OfferSource {
    return OfferSource.EPIC;
  }

  getType(): OfferType {
    return OfferType.GAME;
  }

  getDuration(): OfferDuration {
    return OfferDuration.CLAIMABLE;
  }

  getOffersUrl(): string {
    return OFFER_URL;
  }

  getPageReadySelector(): string {
    return "h1";
  }

  protected override offersExpected(): boolean {
    return true;
  }

  protected override async pageLoadedHook(page: Page): Promise<void> {
    // Scroll to bottom to make free games section load
    await this.scrollPageToBottom(page);
  }

  getOfferHandlers(page: Page): OfferHandler<EpicRawOffer>[] {
    return [
      {
        locator: page.locator('//span[text()="Free Now"]//ancestor::a'),
        readOffer: this.readRawOffer.bind(this),
        normalizeOffer: (offer: RawOffer): NewOffer => {
          // Type guard to ensure offer is EpicRawOffer
          if (!offer.validTo) {
            throw new Error("Invalid Epic offer: missing validTo");
          }
          return this.normalizeOffer(offer as EpicRawOffer);
        },
      },
    ];
  }

  private async readRawOffer(element: Locator): Promise<EpicRawOffer | null> {
    try {
      // Scroll element into view to load img url
      await element.scrollIntoViewIfNeeded();

      const title = await element.locator("//h6").textContent();
      if (!title) throw new Error("Couldn't find title");

      // For current offers, the date is included twice but both mean the enddate
      // Format: 2022-02-24T16:00:00.000Z
      const validTo = await element
        .locator('//span[text()="Free Now - "]/time[1]')
        .getAttribute("datetime");
      if (!validTo) throw new Error(`Couldn't find valid to for ${title}`);

      let url = await element.getAttribute("href");
      if (!url) throw new Error(`Couldn't find url for ${title}`);
      if (!url.startsWith("http")) {
        url = BASE_URL + url;
      }

      const imgUrl = await element.locator("img").getAttribute("src");
      if (!imgUrl) throw new Error(`Couldn't find image for ${title}`);

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

  private normalizeOffer(rawOffer: EpicRawOffer): NewOffer {
    const rawtext = {
      title: rawOffer.title,
      enddate: rawOffer.validTo,
    };

    let validTo: Date | null = null;
    try {
      validTo = DateTime.fromISO(rawOffer.validTo).toJSDate();
    } catch (error) {
      this.logger.error(
        `Failed to parse date ${rawOffer.validTo}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return {
      source: this.getSource(),
      duration: this.getDuration(),
      type: this.getType(),
      title: rawOffer.title,
      probable_game_name: rawOffer.title,
      seen_last: new Date().toISOString(),
      seen_first: new Date().toISOString(),
      valid_to: validTo?.toISOString() ?? null,
      rawtext: JSON.stringify(rawtext),
      url: rawOffer.url ?? null,
      img_url: rawOffer.imgUrl ?? null,
      category: "", // Will be set by categorization
    };
  }
}

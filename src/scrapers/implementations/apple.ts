import { OfferDuration, OfferSource, OfferType } from "@/types/config";
import type { NewOffer } from "@/types/database";
import type { Locator, Page } from "playwright";
import { BaseScraper, type OfferHandler, type RawOffer } from "../base/scraper";

const ROOT_URL = "https://appsliced.co/apps/iphone";
const SEARCH_PARAMS = new URLSearchParams({
  sort: "latest",
  price: "free",
  "cat[]": "6014",
  page: "1",
});

export class AppleGamesScraper extends BaseScraper {
  getSource(): OfferSource {
    return OfferSource.APPLE;
  }

  getType(): OfferType {
    return OfferType.GAME;
  }

  getDuration(): OfferDuration {
    return OfferDuration.CLAIMABLE;
  }

  protected override offersExpected(): boolean {
    return true;
  }

  getOffersUrl(): string {
    return `${ROOT_URL}?${SEARCH_PARAMS.toString()}`;
  }

  getPageReadySelector(): string {
    return "article.app";
  }

  getOfferHandlers(page: Page): OfferHandler<RawOffer>[] {
    return [
      {
        locator: page.locator("article.app"),
        readOffer: this.readRawOffer.bind(this),
        normalizeOffer: this.normalizeOffer.bind(this),
      },
    ];
  }

  private async readRawOffer(element: Locator): Promise<RawOffer | null> {
    try {
      const title = await element.locator(".title a").getAttribute("title");
      if (!title) throw new Error("Couldn't find title");

      const url = await element.locator(".title a").getAttribute("href");
      if (!url) throw new Error(`Couldn't find url for ${title}`);

      const imgUrl = await element.locator(".icon img").getAttribute("src");
      if (!imgUrl) throw new Error(`Couldn't find image for ${title}`);

      return {
        title,
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

  private normalizeOffer(rawOffer: RawOffer): NewOffer {
    const rawtext = {
      title: rawOffer.title,
    };

    return {
      source: this.getSource(),
      duration: this.getDuration(),
      type: this.getType(),
      title: rawOffer.title,
      probable_game_name: rawOffer.title,
      seen_last: new Date().toISOString(),
      valid_to: null,
      rawtext: JSON.stringify(rawtext),
      url: rawOffer.url ?? null,
      img_url: rawOffer.imgUrl ?? null,
      category: "", // Will be set by categorization
    };
  }
}

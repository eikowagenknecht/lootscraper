import { OfferDuration } from "@/types/config";
import type { NewOffer } from "@/types/database";
import type { Locator, Page } from "playwright";
import { GogBaseScraper, type GogRawOffer } from "./base";

const BASE_URL = "https://www.gog.com";
const OFFER_URL = `${BASE_URL}/partner/free_games`;

export class GogGamesAlwaysFreeScraper extends GogBaseScraper {
  getDuration(): OfferDuration {
    return OfferDuration.ALWAYS;
  }

  protected override offersExpected(): boolean {
    return true;
  }

  getOffersUrl(): string {
    return OFFER_URL;
  }

  getPageReadySelector(): string {
    return ".content.cf";
  }

  getOfferHandlers(page: Page) {
    return [
      {
        locator: page.locator(".product-row__link"),
        readOffer: this.readRawOffer.bind(this),
        normalizeOffer: this.normalizeOffer.bind(this),
      },
    ];
  }

  private async readRawOffer(element: Locator): Promise<GogRawOffer | null> {
    try {
      const title = await element.locator(".product-title__text").textContent();
      if (!title) throw new Error("Couldn't find title");

      let url = await element.getAttribute("href");
      if (!url) throw new Error(`Couldn't find url for ${title}`);
      if (!url.startsWith("http")) {
        url = BASE_URL + url;
      }

      const imgUrl = this.sanitizeImgUrl(
        await element.locator("img").getAttribute("srcset"),
      );
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

  private normalizeOffer(rawOffer: GogRawOffer): NewOffer {
    return {
      source: this.getSource(),
      duration: this.getDuration(),
      type: this.getType(),
      title: rawOffer.title,
      probable_game_name: rawOffer.title,
      seen_last: new Date().toISOString(),
      valid_to: null,
      rawtext: JSON.stringify({
        title: rawOffer.title,
      }),
      url: rawOffer.url ?? null,
      img_url: rawOffer.imgUrl ?? null,
      category: "", // Will be set by categorization
    };
  }
}

import { OfferDuration, OfferType } from "@/types/basic";
import { OfferSource } from "@/types/basic";
import type { NewOffer } from "@/types/database";
import { logger } from "@/utils/logger";
import { DateTime } from "luxon";
import type { Locator, Page } from "playwright";
import { errors } from "playwright";
import {
  BaseScraper,
  type CronConfig,
  type OfferHandler,
  type RawOffer,
} from "../base/scraper";

const BASE_URL = "https://itch.io";
const OFFER_URL = `${BASE_URL}/games/new-and-popular/on-sale`;

export class ItchGamesScraper extends BaseScraper {
  override getSchedule(): CronConfig[] {
    return [
      { schedule: "0 0 */3 * * *" }, // Every 3 hours
    ];
  }
  getSource(): OfferSource {
    return OfferSource.ITCH;
  }

  getType(): OfferType {
    return OfferType.GAME;
  }

  getDuration(): OfferDuration {
    return OfferDuration.CLAIMABLE;
  }

  protected override shouldAlwaysHaveOffers(): boolean {
    return true;
  }

  getOffersUrl(): string {
    return OFFER_URL;
  }

  getPageReadySelector(): string {
    return ".game_grid_widget .game_cell";
  }

  protected override async pageLoadedHook(page: Page): Promise<void> {
    await this.scrollPageToBottom(page);
  }

  getOfferHandlers(page: Page): OfferHandler<RawOffer>[] {
    return [
      {
        locator: page.locator(".game_grid_widget .game_cell", {
          has: page.locator(".sale_tag", { hasText: "100" }),
        }),
        readOffer: this.readRawOffer.bind(this),
        normalizeOffer: this.normalizeOffer.bind(this),
      },
    ];
  }

  private async readRawOffer(element: Locator): Promise<RawOffer | null> {
    try {
      // Scroll into view to make sure the image is loaded
      await element.scrollIntoViewIfNeeded();

      const title = await element.locator("a.title").textContent();
      if (!title) throw new Error("Couldn't find title");

      let url = await element.locator("a.title").getAttribute("href");
      if (!url) throw new Error(`Couldn't find url for ${title}`);
      if (!url.startsWith("http")) {
        url = BASE_URL + url;
      }

      // Some games don't have an image
      let imgUrl: string | null = null;
      try {
        imgUrl = await element
          .locator("img")
          .getAttribute("src", { timeout: 1000 });
      } catch (error) {
        if (!(error instanceof errors.TimeoutError)) {
          throw error;
        }
      }

      return {
        title,
        url,
        ...(imgUrl && { imgUrl }),
      };
    } catch (error) {
      logger.error(
        `Failed to read raw offer: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private normalizeOffer(rawOffer: RawOffer): Omit<NewOffer, "category"> {
    const rawtext = {
      title: rawOffer.title,
    };

    return {
      source: this.getSource(),
      duration: this.getDuration(),
      type: this.getType(),
      title: rawOffer.title,
      probable_game_name: rawOffer.title,
      seen_last: DateTime.now().toISO(),
      seen_first: DateTime.now().toISO(),
      valid_to: null,
      rawtext: JSON.stringify(rawtext),
      url: rawOffer.url ?? null,
      img_url: rawOffer.imgUrl ?? null,
    };
  }
}

import type { Locator, Page } from "playwright";

import { DateTime } from "luxon";
import { errors } from "playwright";

import type { CronConfig } from "@/services/scraper/base/scraper";
import type { NewOffer } from "@/types/database";

import { scrollPageToBottom } from "@/services/browser/utils";
import { BaseScraper } from "@/services/scraper/base/scraper";
import { OfferDuration, OfferPlatform, OfferSource, OfferType } from "@/types/basic";
import { cleanGameTitle } from "@/utils";
import { logger } from "@/utils/logger";

const BASE_URL = "https://itch.io";
const OFFER_URL = `${BASE_URL}/games/new-and-popular/on-sale`;

export class ItchGamesScraper extends BaseScraper {
  override getSchedule(): CronConfig[] {
    return [
      { schedule: "0 0 */3 * * *" }, // Every 3 hours
    ];
  }

  getScraperName(): string {
    return "ItchGames";
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

  override getPlatform(): OfferPlatform {
    return OfferPlatform.PC;
  }

  override readOffers(): Promise<Omit<NewOffer, "category">[]> {
    return super.readWebOffers({
      offersUrl: OFFER_URL,
      offerHandlers: [
        {
          locator: ".game_grid_widget .game_cell:has(.sale_tag:text('100'))",
          readOffer: this.readOffer.bind(this),
        },
      ],
      pageReadySelector: ".game_grid_widget .game_cell",
      pageLoadedHook: async (page: Page) => {
        // Scroll to bottom to make all free games load
        await scrollPageToBottom(page);
      },
    });
  }

  protected override shouldAlwaysHaveOffers(): boolean {
    return true;
  }

  private async readOffer(element: Locator): Promise<Omit<NewOffer, "category"> | null> {
    try {
      // Scroll into view to make sure the image is loaded
      await element.scrollIntoViewIfNeeded();

      const title = await element.locator("a.title").textContent();
      if (!title) {
        throw new Error("Couldn't find title");
      }

      let url = await element.locator("a.title").getAttribute("href");
      if (!url) {
        throw new Error(`Couldn't find url for ${title}`);
      }
      if (!url.startsWith("http")) {
        url = BASE_URL + url;
      }

      // Some games don't have an image
      let imgUrl: string | null = null;
      try {
        imgUrl = await element.locator("img").getAttribute("src", { timeout: 1000 });
      } catch (error) {
        if (!(error instanceof errors.TimeoutError)) {
          throw error;
        }
      }

      return {
        source: this.getSource(),
        duration: this.getDuration(),
        type: this.getType(),
        platform: this.getPlatform(),
        title: cleanGameTitle(title),
        probable_game_name: cleanGameTitle(title),
        seen_last: DateTime.now().toISO(),
        seen_first: DateTime.now().toISO(),
        valid_to: null,
        rawtext: JSON.stringify({
          title: title,
        }),
        url: url,
        img_url: imgUrl ?? null,
      };
    } catch (error) {
      logger.error(
        `${this.getScraperName()}: Failed to read raw offer: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}

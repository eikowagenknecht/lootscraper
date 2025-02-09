import { BaseScraper, type CronConfig } from "@/services/scraper/base/scraper";
import {
  OfferDuration,
  OfferPlatform,
  OfferSource,
  OfferType,
} from "@/types/basic";
import type { NewOffer } from "@/types/database";
import { logger } from "@/utils/logger";
import { DateTime } from "luxon";
import type { Locator } from "playwright";

const ROOT_URL = "https://appsliced.co/apps/iphone";
const SEARCH_PARAMS = new URLSearchParams({
  sort: "latest",
  price: "free",
  "cat[]": "6014",
  page: "1",
});

export class AppleGamesScraper extends BaseScraper {
  override getSchedule(): CronConfig[] {
    // Run once a day only to avoid being blocked
    return [
      { schedule: "0 0 12 * * *" }, // 12:00 UTC Daily
    ];
  }

  getScraperName(): string {
    return "AppleGames";
  }

  getSource(): OfferSource {
    return OfferSource.APPLE;
  }

  getType(): OfferType {
    return OfferType.GAME;
  }

  getDuration(): OfferDuration {
    return OfferDuration.CLAIMABLE;
  }

  override getPlatform(): OfferPlatform {
    return OfferPlatform.IOS;
  }

  override readOffers(): Promise<Omit<NewOffer, "category">[]> {
    return super.readWebOffers({
      offersUrl: `${ROOT_URL}?${SEARCH_PARAMS.toString()}`,
      offerHandlers: [
        {
          locator: "article.app",
          readOffer: this.readOffer.bind(this),
        },
      ],
      pageReadySelector: "article.app",
    });
  }

  protected override shouldAlwaysHaveOffers(): boolean {
    return true;
  }

  private async readOffer(
    element: Locator,
  ): Promise<Omit<NewOffer, "category"> | null> {
    try {
      const title = await element.locator(".title a").getAttribute("title");
      if (!title) throw new Error("Couldn't find title");

      const url = await element.locator(".title a").getAttribute("href");
      if (!url) throw new Error(`Couldn't find url for ${title}`);

      const imgUrl = await element.locator(".icon img").getAttribute("src");
      if (!imgUrl) throw new Error(`Couldn't find image for ${title}`);

      return {
        source: this.getSource(),
        duration: this.getDuration(),
        type: this.getType(),
        platform: this.getPlatform(),
        title: title,
        probable_game_name: title,
        seen_last: DateTime.now().toISO(),
        seen_first: DateTime.now().toISO(),
        valid_to: null,
        rawtext: JSON.stringify({
          title: title,
        }),
        url: url,
        img_url: imgUrl,
      };
    } catch (error) {
      logger.error(
        `Failed to read raw offer: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}

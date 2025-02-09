import type { CronConfig } from "@/services/scraper/base/scraper";
import { OfferDuration, OfferPlatform } from "@/types/basic";
import type { NewOffer } from "@/types/database";
import { logger } from "@/utils/logger";
import { DateTime } from "luxon";
import type { Locator, Page } from "playwright";
import { GogBaseScraper } from "./base";

const BASE_URL = "https://www.gog.com";
const OFFER_URL = `${BASE_URL}/partner/free_games`;

export class GogGamesAlwaysFreeScraper extends GogBaseScraper {
  override getSchedule(): CronConfig[] {
    return [
      { schedule: "0 0 12 * * *" }, // Once a day at 12:00 UTC
    ];
  }

  getScraperName(): string {
    return "GogAlwaysFree";
  }

  getDuration(): OfferDuration {
    return OfferDuration.ALWAYS;
  }

  override getPlatform(): OfferPlatform {
    return OfferPlatform.PC;
  }

  override readOffers(): Promise<Omit<NewOffer, "category">[]> {
    return super.readWebOffers({
      offersUrl: OFFER_URL,
      offerHandlers: [
        {
          locator: ".product-row__link",
          readOffer: this.readOffer.bind(this),
        },
      ],
      pageReadySelector: ".content.cf",
      pageLoadedHook: async (page: Page) => {
        await this.switchToEnglish(page);
      },
    });
  }

  protected override shouldAlwaysHaveOffers(): boolean {
    return true;
  }

  private async readOffer(
    element: Locator,
  ): Promise<Omit<NewOffer, "category"> | null> {
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
        `Failed to read offer: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}

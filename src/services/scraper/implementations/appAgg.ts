import { scrollPageToBottom } from "@/services/browser/utils";
import { BaseScraper, type CronConfig } from "@/services/scraper/base/scraper";
import {
  OfferDuration,
  OfferPlatform,
  OfferSource,
  OfferType,
} from "@/types/basic";
import type { NewOffer } from "@/types/database";
import { cleanGameTitle } from "@/utils";
import { logger } from "@/utils/logger";
import { DateTime } from "luxon";
import type { Locator, Page } from "playwright";

const BASE_URL = "https://appagg.com";
const OFFER_URL = `${BASE_URL}/sale/android-games/free/?hl=en`;

export class AppAggGamesScraper extends BaseScraper {
  override getSchedule(): CronConfig[] {
    // Run once a day only to avoid being blocked
    return [
      { schedule: "0 0 12 * * *" }, // 12:00 UTC Daily
    ];
  }

  getScraperName(): string {
    return "AppAggGames";
  }

  getSource(): OfferSource {
    return OfferSource.GOOGLE;
  }

  getType(): OfferType {
    return OfferType.GAME;
  }

  getDuration(): OfferDuration {
    return OfferDuration.CLAIMABLE;
  }

  override getPlatform(): OfferPlatform {
    return OfferPlatform.ANDROID;
  }

  override readOffers(): Promise<Omit<NewOffer, "category">[]> {
    return super.readWebOffers({
      offersUrl: OFFER_URL,
      offerHandlers: [
        {
          locator: "div.short_info",
          readOffer: this.readOffer.bind(this),
        },
      ],
      pageReadySelector: "div.short_info",
      pageLoadedHook: async (page: Page) => {
        // Scroll to bottom to show all games
        await scrollPageToBottom(page);
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
      // Scroll into view for images to load
      await element.scrollIntoViewIfNeeded();

      const title = await element.locator("li.si_tit a").textContent();
      if (!title) throw new Error("Couldn't find title");

      let url = await element.locator("li.si_tit a").getAttribute("href");
      if (!url) throw new Error(`Couldn't find url for ${title}`);
      if (!url.startsWith("http")) {
        url = BASE_URL + url;
      }

      // Try to get img from data attribute.
      let imgUrl = await element
        .locator("span.pic_div")
        .getAttribute("data-ico");

      // Fallback to style (it's moved here when the image is loaded)
      if (!imgUrl) {
        const style = await element
          .locator("span.pic_div")
          .getAttribute("style");
        if (style) {
          // Extract URL from background-image style
          imgUrl = style
            .replace('background-image: url("', "")
            .replace('");', "");
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
        seen_first: DateTime.now().toISO(), // Added seen_first property
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

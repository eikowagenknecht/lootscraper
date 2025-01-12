import {
  BaseScraper,
  type CronConfig,
  type OfferHandler,
  type RawOffer,
} from "@/scrapers/base/scraper";
import { OfferDuration, OfferSource, OfferType } from "@/types/basic";
import type { NewOffer } from "@/types/database";
import { logger } from "@/utils/logger";
import { DateTime } from "luxon";
import type { Locator, Page } from "playwright";

const BASE_URL = "https://appagg.com";
const OFFER_URL = `${BASE_URL}/sale/android-games/free/?hl=en`;

export class GoogleGamesScraper extends BaseScraper {
  override getSchedule(): CronConfig[] {
    // Run once a day only to avoid being blocked
    return [
      { schedule: "0 0 12 * * *" }, // 12:00 UTC Daily
    ];
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

  protected override shouldAlwaysHaveOffers(): boolean {
    return true;
  }

  getOffersUrl(): string {
    return OFFER_URL;
  }

  getPageReadySelector(): string {
    return "div.short_info";
  }

  protected override async pageLoadedHook(page: Page): Promise<void> {
    await this.scrollPageToBottom(page);
  }

  getOfferHandlers(page: Page): OfferHandler<RawOffer>[] {
    return [
      {
        locator: page.locator("div.short_info"),
        readOffer: this.readRawOffer.bind(this),
        normalizeOffer: this.normalizeOffer.bind(this),
      },
    ];
  }

  private async readRawOffer(element: Locator): Promise<RawOffer | null> {
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
    return {
      source: this.getSource(),
      duration: this.getDuration(),
      type: this.getType(),
      title: rawOffer.title,
      probable_game_name: rawOffer.title,
      seen_last: DateTime.now().toISO(),
      seen_first: DateTime.now().toISO(), // Added seen_first property
      valid_to: null,
      rawtext: JSON.stringify({
        title: rawOffer.title,
      }),
      url: rawOffer.url ?? null,
      img_url: rawOffer.imgUrl ?? null,
    };
  }
}

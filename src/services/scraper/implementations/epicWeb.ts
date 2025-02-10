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

const BASE_URL = "https://store.epicgames.com";
const OFFER_URL = `${BASE_URL}/en-US/`;

export class EpicGamesWebScraper extends BaseScraper {
  override getSchedule(): CronConfig[] {
    // Epic Games updates their free games every Thursday at 11:00 US/Eastern
    // Check soon after release and a backup check later in the day. Also
    // daily, because in the christmas period they sometimes release games more often.
    return [
      { schedule: "0 5 11 * * *", timezone: "US/Eastern" }, // 17:05 UTC Daily (check soon after release)
      { schedule: "0 5 13 * * *", timezone: "US/Eastern" }, // 19:05 UTC Daily (backup check)
    ];
  }

  getScraperName(): string {
    return "EpicGamesWeb";
  }

  getSource(): OfferSource {
    return OfferSource.EPIC;
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
          locator: '//span[text()="Free Now"]//ancestor::a',
          readOffer: this.readOffer.bind(this),
        },
      ],
      pageReadySelector: "h1",
      pageLoadedHook: async (page: Page) => {
        // Scroll to bottom to make free games section load
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

      let validToAsDate: DateTime | null = null;
      try {
        validToAsDate = DateTime.fromISO(validTo);
      } catch (error) {
        logger.error(
          `Failed to parse date ${validTo}: ${error instanceof Error ? error.message : String(error)}`,
        );
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
        valid_to: validToAsDate?.toISO() ?? null,
        rawtext: JSON.stringify({
          title: title,
          enddate: validTo,
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

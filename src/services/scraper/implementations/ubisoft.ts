import {
  BaseScraper,
  type CronConfig,
  type OfferHandler,
} from "@/services/scraper/base/scraper";
import { OfferDuration, OfferSource, OfferType } from "@/types/basic";
import type { NewOffer } from "@/types/database";
import { logger } from "@/utils/logger";
import { DateTime } from "luxon";
import type { Locator, Page } from "playwright";

const BASE_URL = "https://store.ubi.com";
const OFFER_URL = `${BASE_URL}/us/`;

export class UbisoftGamesScraper extends BaseScraper {
  override getSchedule(): CronConfig[] {
    return [
      { schedule: "0 0 */3 * * *" }, // Every 3 hours
    ];
  }

  getScraperName(): string {
    return "UbisoftGames";
  }

  getSource(): OfferSource {
    return OfferSource.UBISOFT;
  }

  getType(): OfferType {
    return OfferType.GAME;
  }

  getDuration(): OfferDuration {
    return OfferDuration.CLAIMABLE;
  }

  protected override shouldAlwaysHaveOffers(): boolean {
    return false;
  }

  getOffersUrl(): string {
    return OFFER_URL;
  }

  getPageReadySelector(): string {
    return ".wrapper";
  }

  getOfferHandlers(page: Page): OfferHandler[] {
    return [
      {
        locator: page.locator(".c-focus-banner__wrapper"),
        readOffer: this.readOffer.bind(this),
      },
    ];
  }

  private async readOffer(
    element: Locator,
  ): Promise<Omit<NewOffer, "category"> | null> {
    try {
      // Scroll element into view to load img url
      await element.scrollIntoViewIfNeeded();

      const title = await element
        .locator(".c-focus-banner__title")
        .textContent();
      if (!title) throw new Error("Couldn't find title");

      // Promotions look like "Get <Assassin's Creed> for free!"
      const compareTitle = title.toLowerCase();
      if (
        !compareTitle.startsWith("get ") ||
        !compareTitle.endsWith(" for free!")
      ) {
        return null;
      }

      let validTo = await element
        .locator(".c-focus-banner__legal-line")
        .innerText();
      if (!validTo) throw new Error(`Couldn't find valid to for ${title}`);

      // Date looks like "Offer ends <January 23, 2023 at 3PM UTC>"
      validTo = validTo
        .replace(/^Offer valid until /, "")
        .replace(/^Offer ends /, "")
        .replace(/ UTC\.$/, "");

      let url = await element.locator("a.button").getAttribute("href");
      if (!url) throw new Error(`Couldn't find url for ${title}`);
      if (!url.startsWith("http")) {
        url = BASE_URL + url;
      }

      let imgUrl = await element.locator("img").getAttribute("src");
      if (!imgUrl) throw new Error(`Couldn't find image for ${title}`);
      if (!imgUrl.startsWith("http")) {
        imgUrl = BASE_URL + imgUrl;
      }

      let validToDate: DateTime | null = null;

      // Try standard format first: "January 23, 2023 at 3PM"
      try {
        validToDate = DateTime.fromFormat(validTo, "MMMM d, yyyy 'at' ha", {
          zone: "UTC",
        });
      } catch (error) {
        logger.debug(
          `Failed to parse date in standard format: ${error instanceof Error ? error.message : String(error)}`,
        );

        // Try alternate format: "January 23 at 2023 at 3PM"
        try {
          validToDate = DateTime.fromFormat(
            validTo,
            "MMMM d 'at' yyyy 'at' ha",
            {
              zone: "UTC",
            },
          );
        } catch (error) {
          logger.error(
            `Failed to parse date in alternate format: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      return {
        source: this.getSource(),
        duration: this.getDuration(),
        type: this.getType(),
        title,
        probable_game_name: title,
        seen_last: DateTime.now().toISO(),
        seen_first: DateTime.now().toISO(),
        ...(validToDate && { valid_to: validToDate.toISO() }),
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

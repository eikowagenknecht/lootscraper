import { DateTime } from "luxon";
import type { Locator, Page } from "playwright";
import type { CronConfig } from "@/services/scraper/base/scraper";
import { ScraperError } from "@/types";
import { OfferDuration, OfferPlatform } from "@/types/basic";
import type { NewOffer } from "@/types/database";
import { logger } from "@/utils/logger";
import { GogBaseScraper, type GogRawOffer } from "./base";

const BASE_URL = "https://www.gog.com";
const OFFER_URL = `${BASE_URL}/#giveaway`;

export class GogGamesScraper extends GogBaseScraper {
  override getSchedule(): CronConfig[] {
    return [
      { schedule: "0 0 * * * *" }, // Every hour
    ];
  }

  getScraperName(): string {
    return "GogGames";
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
          // Banner giveaways
          locator: "a.giveaway-banner",
          readOffer: this.readOfferV1.bind(this),
        },
        {
          // Big spot offers
          locator: "a.big-spot:has([ng-if='tile.isFreeVisible'])",
          readOffer: this.readOfferV2.bind(this),
        },
        {
          // Giveaway component offers
          locator: "giveaway",
          readOffer: this.readOfferV3.bind(this),
        },
      ],
      pageReadySelector: ".wrapper",
      pageLoadedHook: async (page: Page) => {
        await this.switchToEnglish(page);
      },
    });
  }

  private async readOfferV1(
    element: Locator,
  ): Promise<Omit<NewOffer, "category"> | null> {
    try {
      let title = await element
        .locator(".giveaway-banner__title")
        .textContent();
      if (!title) throw new Error("Could not read title");

      // Clean up title
      title = title
        .replace(/\n/g, " ")
        .trim()
        .replace(/^Claim /, "")
        .replace(/ and don't miss the best GOG offers in the future!$/, "");

      const validTo = await element
        .locator("gog-countdown-timer")
        .getAttribute("end-date");

      let url = await element.getAttribute("href");
      if (url && !url.startsWith("http")) {
        url = BASE_URL + url;
      }

      if (!url) throw new Error(`Couldn't find url for ${title}`);

      const imgUrl = this.sanitizeImgUrl(
        await element
          .locator(
            '.giveaway-banner__image source[type="image/png"]:not([media])',
          )
          .getAttribute("srcset"),
      );

      if (!imgUrl) throw new Error(`Couldn't find image for ${title}`);

      return this.normalizeOffer({
        title,
        validTo: validTo ?? "",
        url,
        imgUrl,
      });
    } catch (error) {
      logger.error(
        `${this.getScraperName()}: Failed to read raw offer v1: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private async readOfferV2(
    element: Locator,
  ): Promise<Omit<NewOffer, "category"> | null> {
    try {
      // Verify it's really free
      const priceElement = element.locator('[ng-if="tile.isFreeVisible"]');
      const priceText = await priceElement.textContent();

      if (!priceText?.toLowerCase().includes("free")) {
        logger.debug("Element doesn't seem to be free");
        return null;
      }

      const href = await element.getAttribute("href");
      if (!href) return null;

      const url = href.startsWith("http") ? href : BASE_URL + href;
      return this.normalizeOffer(await this.readOfferFromDetailsPage(url));
    } catch (error) {
      logger.error(
        `${this.getScraperName()}: Failed to read raw offer v2: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private async readOfferV3(
    element: Locator,
  ): Promise<Omit<NewOffer, "category"> | null> {
    try {
      const link = element.locator("a.giveaway__overlay-link");
      const href = await link.getAttribute("href");
      if (!href) return null;

      const url = href.startsWith("http") ? href : BASE_URL + href;
      return this.normalizeOffer(await this.readOfferFromDetailsPage(url));
    } catch (error) {
      logger.error(
        `${this.getScraperName()}: Failed to read raw offer v3: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private async readOfferFromDetailsPage(url: string): Promise<GogRawOffer> {
    if (!this.context) {
      throw new ScraperError(
        "Browser context not initialized. Call initialize() first.",
        this.getSource(),
      );
    }

    let page = null;
    try {
      page = await this.context.newPage();
      await page.goto(url, { timeout: 30000 });

      let title = await page
        .locator(".productcard-basics__title")
        .textContent();
      if (!title) throw new Error("Couldn't find title");

      title = title.replace(/\n/g, " ").trim();

      const imgUrl = this.sanitizeImgUrl(
        await page.locator(".productcard-player__logo").getAttribute("srcset"),
      );
      if (!imgUrl) throw new Error(`Couldn't find image for ${title}`);

      return {
        title,
        url,
        imgUrl,
      };
    } catch (error) {
      throw new Error(
        `Failed to read offer details: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      await page?.close();
    }
  }

  private normalizeOffer(rawOffer: GogRawOffer): Omit<NewOffer, "category"> {
    const rawtext: Record<string, unknown> = {
      title: rawOffer.title,
    };

    if (rawOffer.validTo) {
      rawtext.enddate = rawOffer.validTo;
    }

    let validTo: DateTime | null = null;
    if (rawOffer.validTo) {
      try {
        const validToUnix = Number.parseInt(rawOffer.validTo, 10);
        validTo = DateTime.fromMillis(validToUnix);
      } catch (error) {
        logger.error(
          `${this.getScraperName()}: Failed to parse date: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return {
      source: this.getSource(),
      duration: this.getDuration(),
      type: this.getType(),
      platform: this.getPlatform(),
      title: rawOffer.title,
      probable_game_name: rawOffer.title,
      seen_last: DateTime.now().toISO(),
      seen_first: DateTime.now().toISO(),
      ...(validTo && { valid_to: validTo.toISO() }),
      rawtext: JSON.stringify(rawtext),
      url: rawOffer.url,
      img_url: rawOffer.imgUrl,
    };
  }
}

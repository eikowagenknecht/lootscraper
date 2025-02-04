import type { CronConfig } from "@/scrapers/base/scraper";
import { ScraperError } from "@/types";
import { OfferDuration } from "@/types/basic";
import type { NewOffer } from "@/types/database";
import { logger } from "@/utils/logger";
import { DateTime } from "luxon";
import type { Locator, Page } from "playwright";
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

  getOffersUrl(): string {
    return OFFER_URL;
  }

  getPageReadySelector(): string {
    return ".wrapper";
  }

  getOfferHandlers(page: Page) {
    return [
      {
        // Banner giveaways
        locator: page.locator("a.giveaway-banner"),
        readOffer: this.readRawOfferV1.bind(this),
        normalizeOffer: this.normalizeOffer.bind(this),
      },
      {
        // Big spot offers
        locator: page.locator("a.big-spot", {
          has: page.locator('[ng-if="tile.isFreeVisible"]'),
        }),
        readOffer: this.readRawOfferV2.bind(this),
        normalizeOffer: this.normalizeOffer.bind(this),
      },
      {
        // Giveaway component offers
        locator: page.locator("giveaway"),
        readOffer: this.readRawOfferV3.bind(this),
        normalizeOffer: this.normalizeOffer.bind(this),
      },
    ];
  }

  private async readRawOfferV1(element: Locator): Promise<GogRawOffer | null> {
    try {
      let title = await element
        .locator(".giveaway-banner__title")
        .textContent();
      if (!title) throw new Error("Could not read title");

      // Clean up title
      title = title
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

      const imgUrl = this.sanitizeImgUrl(
        await element
          .locator(
            '.giveaway-banner__image source[type="image/png"]:not([media])',
          )
          .getAttribute("srcset"),
      );

      return {
        title,
        validTo: validTo ?? "",
        ...(url && { url }),
        ...(imgUrl && { imgUrl }),
      };
    } catch (error) {
      logger.error(
        `Failed to read raw offer v1: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private async readRawOfferV2(element: Locator): Promise<GogRawOffer | null> {
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
      return await this.readOfferFromDetailsPage(url);
    } catch (error) {
      logger.error(
        `Failed to read raw offer v2: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private async readRawOfferV3(element: Locator): Promise<GogRawOffer | null> {
    try {
      const link = element.locator("a.giveaway__overlay-link");
      const href = await link.getAttribute("href");
      if (!href) return null;

      const url = href.startsWith("http") ? href : BASE_URL + href;
      return await this.readOfferFromDetailsPage(url);
    } catch (error) {
      logger.error(
        `Failed to read raw offer v3: ${error instanceof Error ? error.message : String(error)}`,
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

      const title = await page
        .locator(".productcard-basics__title")
        .textContent();
      if (!title) throw new Error("Couldn't find title");

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
        const validToUnix = Number.parseInt(rawOffer.validTo);
        validTo = DateTime.fromMillis(validToUnix);
      } catch (error) {
        logger.error(
          `Failed to parse date: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return {
      source: this.getSource(),
      duration: this.getDuration(),
      type: this.getType(),
      title: rawOffer.title,
      probable_game_name: rawOffer.title,
      seen_last: DateTime.now().toISO(),
      seen_first: DateTime.now().toISO(),
      ...(validTo && { valid_to: validTo.toISO() }),
      rawtext: JSON.stringify(rawtext),
      url: rawOffer.url ?? OFFER_URL,
      img_url: rawOffer.imgUrl ?? null,
    };
  }
}

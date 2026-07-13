/**
 * Fab Limited-Time Free Scraper
 *
 * Fab (https://www.fab.com) is Epic's marketplace for digital assets (Unreal
 * Engine, Unity, etc.). Every two weeks a small set of paid assets is offered
 * for free for a limited time on https://www.fab.com/limited-time-free.
 *
 * Fab sits behind a Cloudflare bot challenge that blocks plain HTTP clients
 * (every path, even robots.txt, is challenged based on the client's TLS
 * fingerprint), so the JSON API cannot be called with fetch() directly like
 * the Epic Games API. Instead, this scraper opens the page in the Playwright
 * browser (which passes the challenge) and calls the internal API that backs
 * the page from within the browser context. That way no fragile DOM selectors
 * are needed.
 */
import { DateTime } from "luxon";

import { browserService } from "@/services/browser";
import type { CronConfig } from "@/services/scraper/base/scraper";
import { BaseScraper } from "@/services/scraper/base/scraper";
import { OfferDuration, OfferPlatform, OfferSource, OfferType } from "@/types/basic";
import type { NewOffer } from "@/types/database";
import { logger } from "@/utils/logger";

const OFFERS_URL = "https://www.fab.com/limited-time-free";
const BLADE_API_URL = "https://www.fab.com/i/blades/free_content_blade";

interface FabThumbnail {
  mediaUrl: string | null;
  images: { url: string; width: number }[] | null;
}

interface FabListing {
  title: string;
  uid: string;
  listingType: string;
  startingPrice: { price: number } | null;
  thumbnails: FabThumbnail[] | null;
}

interface FreeContentBlade {
  // The end date of the current rotation is only available as part of the
  // title, e.g. "Limited-Time Free (Until July 14 at 9:59 AM ET)".
  title: string;
  tiles: { listing: FabListing | null }[];
}

interface BladeFetchResult {
  status: number;
  blade?: unknown;
}

export class FabAssetsScraper extends BaseScraper {
  override getSchedule(): CronConfig[] {
    // Fab rotates its limited-time free assets every two weeks on Tuesdays
    // around 10:00 US/Eastern. Check daily shortly after that, with one
    // backup check later in the day.
    return [
      { schedule: "0 15 10 * * *", timezone: "US/Eastern" },
      { schedule: "0 15 16 * * *", timezone: "US/Eastern" },
    ];
  }

  getScraperName(): string {
    return "FabAssets";
  }

  getSource(): OfferSource {
    return OfferSource.FAB;
  }

  getType(): OfferType {
    return OfferType.ASSET;
  }

  getDuration(): OfferDuration {
    return OfferDuration.CLAIMABLE;
  }

  override getPlatform(): OfferPlatform {
    return OfferPlatform.PC;
  }

  protected override shouldAlwaysHaveOffers(): boolean {
    return true;
  }

  override async readOffers(): Promise<Omit<NewOffer, "category">[]> {
    const result = await this.fetchBlade();

    if (result.status !== 200 || result.blade === undefined) {
      logger.warn(`Fab API returned ${result.status.toFixed(0)}`);
      throw new Error(`Fab API returned ${result.status.toFixed(0)}`);
    }

    const blade = result.blade;
    if (!blade || typeof blade !== "object" || !("tiles" in blade) || !Array.isArray(blade.tiles)) {
      logger.warn(`No tiles returned from the Fab API. Response: ${JSON.stringify(blade)}`);
      throw new Error("No tiles returned from the Fab API");
    }

    return this.parseOffers(blade as FreeContentBlade);
  }

  /**
   * Load the offers page to pass the Cloudflare challenge, then call the
   * internal API that backs it from within the browser context.
   * @returns The HTTP status and, on success, the parsed blade response.
   */
  private async fetchBlade(): Promise<BladeFetchResult> {
    const context = browserService.getContext();
    const page = await context.newPage();

    try {
      await page.goto(OFFERS_URL, { timeout: 30_000, waitUntil: "domcontentloaded" });

      return await page.evaluate(async (apiUrl) => {
        const response = await fetch(apiUrl, { headers: { Accept: "application/json" } });
        if (!response.ok) {
          return { status: response.status };
        }
        return { status: response.status, blade: (await response.json()) as unknown };
      }, BLADE_API_URL);
    } finally {
      await page.close();
    }
  }

  private parseOffers(blade: FreeContentBlade): Omit<NewOffer, "category">[] {
    const validTo = this.parseEndDate(blade.title);
    if (validTo === null) {
      logger.warn(
        `${this.getScraperName()}: Could not parse the end date from the blade title "${blade.title}"`,
      );
    }

    const offers: Omit<NewOffer, "category">[] = [];
    for (const tile of blade.tiles) {
      const listing = tile.listing;
      if (!listing?.title || !listing.uid) {
        continue;
      }

      offers.push({
        source: this.getSource(),
        duration: this.getDuration(),
        type: this.getType(),
        platform: this.getPlatform(),
        title: listing.title,
        // Fab assets are not games, so game info enrichment is skipped by
        // leaving this empty.
        probable_game_name: "",
        seen_last: DateTime.now().toISO(),
        seen_first: DateTime.now().toISO(),
        rawtext: JSON.stringify({
          title: listing.title,
          uid: listing.uid,
          price: listing.startingPrice?.price ?? null,
        }),
        valid_from: null,
        valid_to: validTo,
        url: `https://www.fab.com/listings/${listing.uid}`,
        img_url: this.getImageUrl(listing),
      });
    }

    return offers;
  }

  /**
   * Extract the end date from the blade title, e.g.
   * "Limited-Time Free (Until July 14 at 9:59 AM ET)".
   * @param bladeTitle The title of the blade containing the end date
   * @returns The end date as an ISO string, or null if it can't be parsed
   */
  private parseEndDate(bladeTitle: string): string | null {
    const match = /\(until (?<date>.+?)\)/iu.exec(bladeTitle);
    if (!match?.groups?.date) {
      return null;
    }

    // The timezone is given as an abbreviation ("ET"), which luxon can't
    // parse, so strip it and use the equivalent IANA zone instead.
    const text = match.groups.date.replace(/\s+E[SD]?T$/u, "");

    for (const format of ["MMMM d 'at' h:mm a", "MMM d 'at' h:mm a", "MMMM d", "MMM d"]) {
      let parsed = DateTime.fromFormat(text, format, { zone: "America/New_York" });
      if (!parsed.isValid) {
        continue;
      }

      // The title contains no year, so luxon assumes the current one. A date
      // that appears to be well in the past belongs to the next year (e.g. a
      // January end date scraped in December).
      if (parsed < DateTime.now().minus({ days: 7 })) {
        parsed = parsed.plus({ years: 1 });
      }

      return parsed.toISO();
    }

    return null;
  }

  private getImageUrl(listing: FabListing): string | null {
    const thumbnail = listing.thumbnails?.[0];
    if (!thumbnail) {
      return null;
    }
    if (thumbnail.mediaUrl) {
      return thumbnail.mediaUrl;
    }

    const largestFirst = [...(thumbnail.images ?? [])].sort((a, b) => b.width - a.width);
    return largestFirst[0]?.url ?? null;
  }
}

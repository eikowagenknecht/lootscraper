import { OfferDuration } from "@/types/basic";
import { OfferSource } from "@/types/basic";
import { BrowserError } from "@/types/errors";
import { logger } from "@/utils/logger";
import { DateTime } from "luxon";
import type { Locator, Page } from "playwright";
import {
  BaseScraper,
  type CronConfig,
  type RawOffer,
} from "../../base/scraper";

const BASE_URL = "https://gaming.amazon.com";
const OFFER_URL = `${BASE_URL}/home`;

export interface AmazonRawOffer extends RawOffer {
  validTo?: string;
}

export abstract class AmazonBaseScraper<
  T extends AmazonRawOffer = AmazonRawOffer,
> extends BaseScraper<T> {
  override getSchedule(): CronConfig[] {
    return [
      { schedule: "0 0 * * * *" }, // Every hour
    ];
  }

  getSource(): OfferSource {
    return OfferSource.AMAZON;
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
    return ".offer-list__content";
  }

  protected override isFakeAlways(): boolean {
    // Offers on Amazon are never valid forever
    return false;
  }

  protected async readBaseRawOffer(element: Locator): Promise<AmazonRawOffer> {
    const title = await element
      .locator(".item-card-details__body__primary h3")
      .textContent();
    if (!title) throw new Error("Couldn't find title");

    const imgUrl = await element
      .locator('[data-a-target="card-image"] img')
      .getAttribute("src");
    if (!imgUrl) throw new Error(`Couldn't find image for ${title}`);

    let url = BASE_URL;
    try {
      const path = await element.getAttribute("href", { timeout: 500 });
      if (path) {
        url += path.startsWith("http") ? "" : path;
      }
    } catch {
      throw new Error(`Couldn't find detail page for ${title}`);
    }

    let validTo: string | undefined;
    try {
      validTo = await this.readDateFromDetailsPage(url);
    } catch (error) {
      // Some offers just have no date. That's fine.
      logger.verbose(
        `No date found for ${title}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return {
      title,
      url,
      imgUrl,
      ...(validTo && { validTo }),
    };
  }

  private async readDateFromDetailsPage(url: string): Promise<string> {
    let page: Page | null = null;
    try {
      page = await this.context.newPage();
      await page.goto(url, { timeout: 30000 });

      const date = await page
        .locator(".availability-date span:nth-child(2)")
        .textContent();

      if (!date) throw new Error("Couldn't find date");

      return date;
    } catch (error) {
      throw new BrowserError(
        `Failed to read date from details page: ${error instanceof Error ? error.message : String(error)}`,
        url,
      );
    } finally {
      await page?.close();
    }
  }

  /**
   * This is a bit more complicated as only the relative end is displayed
   * ("Ends in ..."). So we have to guess the real date:
   *
   * The *year* is guessed assuming that old offers are not shown any more.
   * "Old" means older than yesterday to avoid time zone problems.
   *
   * The *day* is more complicated. The seen values are:
   * "Ends in x days", "Ends tomorrow", "Ends today", no time given.
   * I've been watching this for some days now for multiple offers and
   * it is quite inconsistent. The x "Ends in x days" mostly counts
   * down by 1 at about 17:00 UTC. But sometimes (for a single offer!)
   * it can also be about an hour later, suggesting that there is some
   * caching in place on Amazon's side. For other offers, it is another
   * time of day entirely. The offers also don't seem to be valid for
   * a timespan that is a multiple of 24 hours, making it even harder
   * to guess.
   *
   * The most accurate approach I can think of would be to track when
   * the "Ends in x days" first counts down by one and then use the
   * new x times 24 hours to calculate the end date. Unfortunately that
   * means having to wait for up to 24 hours after the offer shows up,
   * so I think the more accurate end time is not really worth the delay.
   *
   * So for now to have something, we will assume that it means
   * "the end of the day in UTC". This is probably up to 1 day wrong,
   * but at least we have a rough indication of when the offer ends.
   *
   * @param dateStr
   * @returns
   */
  protected parseDateString(dateStr: string): Date | null {
    try {
      const raw = dateStr.replace(/^Ends\s+/, "");
      const now = DateTime.now().setZone("UTC").startOf("day");

      if (raw.toLowerCase() === "today") {
        return now.toJSDate();
      }
      if (raw.toLowerCase() === "tomorrow") {
        return now.plus({ days: 1 }).toJSDate();
      }

      // Try parsing "MMM D, YYYY" format
      return DateTime.fromFormat(raw, "LLL d, yyyy", {
        zone: "UTC",
      }).toJSDate();
    } catch (error) {
      logger.error(
        `Date parsing failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}

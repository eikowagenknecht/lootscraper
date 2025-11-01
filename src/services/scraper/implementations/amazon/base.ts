import { DateTime } from "luxon";
import type { Locator, Page } from "playwright";
import { BaseScraper, type CronConfig } from "@/services/scraper/base/scraper";
import { OfferDuration, OfferPlatform, OfferSource } from "@/types/basic";
import { BrowserError, ScraperError } from "@/types/errors";
import { logger } from "@/utils/logger";

const BASE_URL = "https://gaming.amazon.com";
export const OFFER_URL = `${BASE_URL}/home`;

interface AmazonBaseOffer {
  title: string;
  url: string;
  imgUrl: string;
  validTo?: string;
}

export abstract class AmazonBaseScraper extends BaseScraper {
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

  override getPlatform(): OfferPlatform {
    return OfferPlatform.PC;
  }

  protected override isFakeAlways(): boolean {
    // Offers on Amazon are never valid forever
    return false;
  }

  protected async readBaseOffer(element: Locator): Promise<AmazonBaseOffer> {
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
      const path = await element.getAttribute("href", { timeout: 5000 });
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
    if (!this.context) {
      throw new ScraperError(
        "Browser context not initialized. Call initialize() first.",
        this.getSource(),
      );
    }

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
      // Ensure page is closed even if there's an error
      if (page) {
        try {
          await page.close();
        } catch (error) {
          logger.error(
            `${this.getScraperName()}: Failed to close detail page: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
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
   * @param dateStr The date string to parse
   * @returns The parsed date or null if parsing failed
   */
  protected parseDateString(dateStr: string): DateTime | null {
    try {
      const raw = dateStr.replace(/^Ends\s+/, "");
      const now = DateTime.now().setZone("UTC").startOf("day");

      if (raw.toLowerCase() === "today") {
        return now;
      }
      if (raw.toLowerCase() === "tomorrow") {
        return now.plus({ days: 1 });
      }

      // Try parsing "MMM D, YYYY" format
      return DateTime.fromFormat(raw, "LLL d, yyyy", {
        zone: "UTC",
      });
    } catch (error) {
      logger.error(
        `${this.getScraperName()}: Date parsing failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}

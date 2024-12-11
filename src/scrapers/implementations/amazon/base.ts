import { OfferDuration, OfferSource } from "@/types/config";
import { BrowserError } from "@/types/errors";
import { DateTime } from "luxon";
import type { Locator, Page } from "playwright";
import { BaseScraper, type RawOffer } from "../../base/scraper";

const BASE_URL = "https://gaming.amazon.com";
const OFFER_URL = `${BASE_URL}/home`;

export interface AmazonRawOffer extends RawOffer {
  validTo?: string;
}

export abstract class AmazonBaseScraper<
  T extends AmazonRawOffer = AmazonRawOffer,
> extends BaseScraper<T> {
  getSource(): OfferSource {
    return OfferSource.AMAZON;
  }

  getDuration(): OfferDuration {
    return OfferDuration.CLAIMABLE;
  }

  protected override offersExpected(): boolean {
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
      this.logger.debug(
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
      this.logger.error(
        `Date parsing failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}

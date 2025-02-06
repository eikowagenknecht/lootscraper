import { BaseScraper } from "@/services/scraper/base/scraper";
import { OfferSource, OfferType } from "@/types/basic";
import type { Page } from "playwright";

// Base interface for GOG offers
export interface GogRawOffer {
  title: string;
  url: string;
  imgUrl: string;
  validTo?: string;
}

export abstract class GogBaseScraper extends BaseScraper {
  getSource(): OfferSource {
    return OfferSource.GOG;
  }

  getType(): OfferType {
    return OfferType.GAME;
  }

  protected override async pageLoadedHook(page: Page): Promise<void> {
    await this.switchToEnglish(page);
  }

  protected sanitizeImgUrl(imgUrl: string | null): string | null {
    if (!imgUrl) return null;

    let sanitized = imgUrl
      .trim()
      .split(",", 1)[0]
      .trim()
      .replace(/ 2x$/, "")
      .replace(/ 1x$/, "");

    if (!sanitized.startsWith("https:")) {
      // Sometimes the URL is missing the protocol
      sanitized = `https:${sanitized}`;
    }

    return sanitized;
  }

  private async switchToEnglish(page: Page): Promise<void> {
    // Check if we're already on English version
    const currentLanguage = await this.getCurrentLanguage(page);
    if (currentLanguage === "English") return;

    await page.locator("li.footer-microservice-language__item").first().click();
    // Give the language switching some time
    await page.waitForTimeout(1000);

    // Check if it's really English now
    const newLanguage = await this.getCurrentLanguage(page);
    if (newLanguage !== "English") {
      throw new Error(
        `Tried switching to English, but ${newLanguage ?? "unknown language"} is active instead.`,
      );
    }
  }

  private async getCurrentLanguage(page: Page): Promise<string | null> {
    return page
      .locator("li.footer-microservice-language__item.is-selected")
      .textContent();
  }
}

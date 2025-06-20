import type { Page } from "playwright";
import { BaseScraper } from "@/services/scraper/base/scraper";
import { OfferSource, OfferType } from "@/types/basic";
import { logger } from "@/utils/logger";

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

  protected async switchToEnglish(page: Page): Promise<void> {
    // Check if we're already on English version
    const currentLanguage = await this.getCurrentLanguage(page);
    if (currentLanguage === "English") return;

    await page.locator("li.footer-microservice-language__item").first().click();

    // Give the language switching some time
    await page.waitForTimeout(1000);

    // Wait for language to change with timeout and retry logic
    await this.waitForLanguageChange(page, "English", {
      timeout: 5000,
      retries: 2,
    });
  }

  private async getCurrentLanguage(page: Page): Promise<string | null> {
    return page
      .locator("li.footer-microservice-language__item.is-selected")
      .textContent();
  }

  private async waitForLanguageChange(
    page: Page,
    expectedLanguage: string,
    options: { timeout: number; retries: number },
  ): Promise<void> {
    const { timeout, retries } = options;
    let attempts = 0;

    while (attempts <= retries) {
      try {
        // Wait for navigation or network idle
        await page.waitForLoadState("networkidle", {
          timeout: timeout / (attempts + 1),
        });

        // Check language
        const currentLanguage = await this.getCurrentLanguage(page);
        if (currentLanguage === expectedLanguage) return;

        logger.warn(
          `Language still not ${expectedLanguage} after attempt ${(attempts + 1).toFixed()}, current: ${currentLanguage ?? "unknown"}`,
        );
        attempts++;

        if (attempts <= retries) {
          // Try clicking the language selector again
          await page
            .locator("li.footer-microservice-language__item")
            .first()
            .click();
        }
      } catch (error) {
        logger.warn(
          `Error waiting for language change, attempt ${(attempts + 1).toFixed()}:`,
          error,
        );
        attempts++;
      }
    }

    throw new Error(
      `Failed to switch to ${expectedLanguage} after ${(retries + 1).toFixed()} attempts.`,
    );
  }
}

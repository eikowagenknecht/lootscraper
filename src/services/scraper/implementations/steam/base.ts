import { BaseScraper, type CronConfig } from "@/services/scraper/base/scraper";
import { ScraperError } from "@/types";
import {
  OfferDuration,
  OfferPlatform,
  OfferSource,
  OfferType,
} from "@/types/basic";
import type { NewOffer } from "@/types/database";
import { logger } from "@/utils/logger";
import { cleanCombinedTitle, cleanGameTitle } from "@/utils/stringTools";
import { DateTime } from "luxon";
import type { Locator, Page } from "playwright";

const BASE_URL = "https://store.steampowered.com";
const SEARCH_URL = `${BASE_URL}/search/`;
const DETAILS_URL = `${BASE_URL}/app/`;

export abstract class SteamBaseScraper extends BaseScraper {
  override getSchedule(): CronConfig[] {
    return [
      { schedule: "0 */30 * * * *" }, // Every 30 minutes
    ];
  }

  getSource(): OfferSource {
    return OfferSource.STEAM;
  }

  getDuration(): OfferDuration {
    return OfferDuration.CLAIMABLE;
  }

  override getPlatform(): OfferPlatform {
    return OfferPlatform.PC;
  }

  override readOffers(): Promise<Omit<NewOffer, "category">[]> {
    const urlParams = new URLSearchParams({
      maxprice: "free",
      category1: this.getSteamCategory().toString(),
      specials: "1",
    });

    const url = `${SEARCH_URL}?${urlParams.toString()}`;

    return super.readWebOffers({
      offersUrl: url,
      offerHandlers: [
        {
          locator: "#search_results a",
          readOffer: this.readOffer.bind(this),
        },
      ],
      pageReadySelector: "#search_results",
    });
  }

  abstract getSteamCategory(): number; // Games or DLC

  abstract getValidtextLocator(page: Page): Locator;

  private async readOffer(
    element: Locator,
  ): Promise<Omit<NewOffer, "category"> | null> {
    if (!this.context) {
      throw new ScraperError(
        "Browser context not initialized. Call initialize() first.",
        this.getSource(),
      );
    }

    try {
      const title = await element.locator(".title").textContent();
      if (!title) throw new Error("Couldn't find title");

      const appid = await element.getAttribute("data-ds-appid");
      if (!appid) throw new Error(`Couldn't find appid for ${title}`);

      const url = `${DETAILS_URL}${appid}`;

      let page = null;
      try {
        page = await this.context.newPage();
        await page.goto(url);

        // Handle age verification if present
        await this.skipAgeVerification(page);
        await page.waitForSelector(".game_area_purchase");

        const imgUrl = await page
          .locator(".game_header_image_full")
          .getAttribute("src");
        if (!imgUrl) throw new Error(`Couldn't find image for ${title}`);

        let text: string;
        try {
          // Get the resolved text here because the text_content() contains
          // special characters.
          text = await page
            .locator(".game_purchase_discount_quantity")
            .innerText();
          if (!text) {
            // Sometimes this does not exist, when a game is not free any more
            // or only some DLCs of the game are free.
            logger.warn(
              `${this.getScraperName()}: Offer for ${title} seems to be broken, skipping it.`,
            );
            return null;
          }
        } catch {
          logger.warn(
            `${this.getScraperName()}: Offer for ${title} doesn't contain any free items, skipping it.`,
          );
          return null;
        }

        let validTo: DateTime | null = null;

        if (text) {
          const dateText = text
            .replace("Free to keep when you get it before ", "")
            .replace(". Some limitations apply. (?)", "");

          let parsedDate: DateTime | null = null;

          try {
            logger.debug(`Parsing date in format for this year: ${dateText}`);

            // Parse Steams "D MMM @ HH:mmAM/PM" format
            parsedDate = DateTime.fromFormat(dateText, "d MMM @ h:mma", {
              zone: "UTC",
            });
            parsedDate = parsedDate.set({ year: DateTime.now().year });
          } catch {
            logger.debug(
              `Couldn't parse date, trying next format: ${dateText}`,
            );
          }

          if (!parsedDate) {
            try {
              // Maybe it's next year, so parse Steams "D MMM, YYYY @ HH:mmAM/PM" format instead
              parsedDate = DateTime.fromFormat(
                dateText,
                "d MMM, yyyy @ h:mma",
                {
                  zone: "UTC",
                },
              );
            } catch {
              logger.warn(
                `${this.getScraperName()}: Couldn't parse date because it's invalid: ${dateText}`,
              );
            }
          }

          if (parsedDate) {
            logger.debug(`Parsed date: ${parsedDate.toISO()}`);
            validTo = parsedDate;
          }
        }

        const cleanedTitle =
          this.getType() === OfferType.GAME
            ? cleanGameTitle(title)
            : cleanCombinedTitle(title)[1];

        const probableGameName =
          this.getType() === OfferType.GAME
            ? cleanGameTitle(title)
            : cleanCombinedTitle(title)[0];

        return {
          source: this.getSource(),
          duration: this.getDuration(),
          type: this.getType(),
          platform: this.getPlatform(),
          title: cleanedTitle,
          probable_game_name: probableGameName,
          seen_last: DateTime.now().toISO(),
          seen_first: DateTime.now().toISO(),
          ...(validTo && { valid_to: validTo.toISO() }),
          rawtext: JSON.stringify({
            title: title,
            appid: appid,
            text: text,
          }),
          url: url,
          img_url: imgUrl,
        };
      } finally {
        await page?.close();
      }
    } catch (error) {
      logger.error(
        `${this.getScraperName()}: Failed to read raw offer: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private async skipAgeVerification(page: Page): Promise<void> {
    const ageSelectors = ["#agecheck_form", "#app_agegate"];

    for (const selector of ageSelectors) {
      try {
        // Check if this age verification form is present
        const ageElement = await page.$(selector);
        if (ageElement) {
          // Select the birth year and click the button
          await page.selectOption("#ageYear", "1990");
          await page.click("#view_product_page_btn");
          await page.waitForLoadState("networkidle");

          // If we successfully handled the age gate, exit the function
          return;
        }
      } catch {
        logger.debug(
          `Age verification element ${selector} not found or failed to handle it`,
        );
      }
    }
  }
}

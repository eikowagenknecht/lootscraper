import type { OfferHandler } from "@/services/scraper/base/scraper";
import { OfferType } from "@/types/basic";
import type { NewOffer } from "@/types/database";
import { logger } from "@/utils/logger";
import { DateTime } from "luxon";
import type { Locator, Page } from "playwright";
import { AmazonBaseScraper } from "./base";

export class AmazonGamesScraper extends AmazonBaseScraper {
  getScraperName(): string {
    return "AmazonGames";
  }

  getType(): OfferType {
    return OfferType.GAME;
  }

  protected override async pageLoadedHook(page: Page): Promise<void> {
    // Switch to the "Games" tab
    const gamesTab = page.locator(
      'button[data-a-target="offer-filter-button-Game"]',
    );
    await gamesTab.click();

    await this.scrollElementToBottom(page, "root");
  }

  getOfferHandlers(page: Page): OfferHandler[] {
    return [
      {
        locator: page.locator(
          '[data-a-target="offer-list-FGWP_FULL"] .item-card__action > a:first-child',
        ),
        readOffer: this.readOffer.bind(this),
      },
    ];
  }

  private async readOffer(
    element: Locator,
  ): Promise<Omit<NewOffer, "category"> | null> {
    try {
      const baseOffer = await this.readBaseOffer(element);

      const validTo = baseOffer.validTo
        ? this.parseDateString(baseOffer.validTo)
        : null;

      return {
        source: this.getSource(),
        duration: this.getDuration(),
        type: this.getType(),
        title: baseOffer.title,
        probable_game_name: baseOffer.title,
        seen_last: DateTime.now().toISO(),
        seen_first: DateTime.now().toISO(),
        valid_to: validTo?.toISO() ?? null,
        rawtext: JSON.stringify({
          title: baseOffer.title,
          enddate: baseOffer.validTo,
        }),
        url: baseOffer.url,
        img_url: baseOffer.imgUrl,
      };
    } catch (error) {
      logger.error(
        `Failed to read offer: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}

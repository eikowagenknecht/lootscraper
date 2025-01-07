import type { OfferHandler } from "@/scrapers/base/scraper";
import { OfferType } from "@/types/basic";
import type { NewOffer } from "@/types/database";
import { logger } from "@/utils/logger";
import { DateTime } from "luxon";
import type { Locator, Page } from "playwright";
import { AmazonBaseScraper, type AmazonRawOffer } from "./base";

export class AmazonGamesScraper extends AmazonBaseScraper {
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

  getOfferHandlers(page: Page): OfferHandler<AmazonRawOffer>[] {
    return [
      {
        locator: page.locator(
          '[data-a-target="offer-list-FGWP_FULL"] .item-card__action > a:first-child',
        ),
        readOffer: this.readRawOffer.bind(this),
        normalizeOffer: this.normalizeOffer.bind(this),
      },
    ];
  }

  private async readRawOffer(element: Locator): Promise<AmazonRawOffer | null> {
    try {
      return await this.readBaseRawOffer(element);
    } catch (error) {
      logger.error(
        `Failed to read raw offer: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private normalizeOffer(rawOffer: AmazonRawOffer): Omit<NewOffer, "category"> {
    const rawtext = {
      title: rawOffer.title,
      enddate: rawOffer.validTo,
    };

    const validTo = rawOffer.validTo
      ? this.parseDateString(rawOffer.validTo)
      : null;

    return {
      source: this.getSource(),
      duration: this.getDuration(),
      type: this.getType(),
      title: rawOffer.title,
      probable_game_name: rawOffer.title,
      seen_last: DateTime.now().toISO(),
      seen_first: DateTime.now().toISO(),
      valid_to: validTo?.toISO() ?? null,
      rawtext: JSON.stringify(rawtext),
      url: rawOffer.url ?? null,
      img_url: rawOffer.imgUrl ?? null,
    };
  }
}

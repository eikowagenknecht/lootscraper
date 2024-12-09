import { OfferType } from "@/types/config";
import type { NewOffer } from "@/types/database";
import type { Locator, Page } from "playwright";
import type { OfferHandler } from "../../base/scraper";
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
      this.logger.error(
        `Failed to read raw offer: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private normalizeOffer(rawOffer: AmazonRawOffer): NewOffer {
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
      seen_last: new Date().toISOString(),
      valid_to: validTo?.toISOString() ?? null,
      rawtext: JSON.stringify(rawtext),
      url: rawOffer.url ?? null,
      img_url: rawOffer.imgUrl ?? null,
      category: "", // Will be set by categorization
    };
  }
}

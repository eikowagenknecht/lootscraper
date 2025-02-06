import type { OfferHandler } from "@/services/scraper/base/scraper";
import { OfferType } from "@/types/basic";
import type { NewOffer } from "@/types/database";
import { logger } from "@/utils/logger";
import { DateTime } from "luxon";
import type { Locator, Page } from "playwright";
import { AmazonBaseScraper } from "./base";

export class AmazonLootScraper extends AmazonBaseScraper {
  getScraperName(): string {
    return "AmazonLoot";
  }

  getType(): OfferType {
    return OfferType.LOOT;
  }

  protected override async pageLoadedHook(page: Page): Promise<void> {
    await this.scrollElementToBottom(page, "root");
  }

  getOfferHandlers(page: Page): OfferHandler[] {
    return [
      {
        locator: page.locator(
          '[data-a-target="offer-list-IN_GAME_LOOT"] .item-card__action > a:first-child',
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

      const gameTitle = await element
        .locator(".item-card-details__body p")
        .nth(0)
        .textContent();
      if (!gameTitle) throw new Error("Couldn't find game title");

      const validTo = baseOffer.validTo
        ? this.parseDateString(baseOffer.validTo)
        : null;
      const title = `${gameTitle}: ${baseOffer.title}`;

      return {
        source: this.getSource(),
        duration: this.getDuration(),
        type: this.getType(),
        title,
        probable_game_name: gameTitle,
        seen_last: DateTime.now().toISO(),
        seen_first: DateTime.now().toISO(),
        valid_to: validTo?.toISO() ?? null,
        rawtext: JSON.stringify({
          title: baseOffer.title,
          gametitle: gameTitle,
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

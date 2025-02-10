import { OfferType } from "@/types/basic";
import type { NewOffer } from "@/types/database";
import { cleanGameTitle } from "@/utils";
import { logger } from "@/utils/logger";
import { cleanLootTitle, combineTitle } from "@/utils/stringTools";
import { DateTime } from "luxon";
import type { Locator, Page } from "playwright";
import { AmazonBaseScraper, OFFER_URL } from "./base";

export class AmazonLootScraper extends AmazonBaseScraper {
  getScraperName(): string {
    return "AmazonLoot";
  }

  getType(): OfferType {
    return OfferType.LOOT;
  }

  override readOffers(): Promise<Omit<NewOffer, "category">[]> {
    return super.readWebOffers({
      offersUrl: OFFER_URL,
      offerHandlers: [
        {
          locator:
            '[data-a-target="offer-list-IN_GAME_LOOT"] .item-card__action > a:first-child',
          readOffer: this.readOffer.bind(this),
        },
      ],
      pageReadySelector: ".offer-list__content",
      pageLoadedHook: async (page: Page) => {
        await this.scrollElementToBottom(page, "root");
      },
    });
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
        ? this.parseDateString(baseOffer.validTo)?.toISO()
        : undefined;

      const cleanedGameTitle = cleanGameTitle(gameTitle);
      const cleanedLootTitle = cleanLootTitle(baseOffer.title);

      return {
        source: this.getSource(),
        duration: this.getDuration(),
        type: this.getType(),
        platform: this.getPlatform(),
        title: combineTitle(cleanedGameTitle, cleanedLootTitle),
        probable_game_name: gameTitle,
        seen_last: DateTime.now().toISO(),
        seen_first: DateTime.now().toISO(),
        valid_to: validTo ?? null,
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

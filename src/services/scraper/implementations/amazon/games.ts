import { OfferType } from "@/types/basic";
import type { NewOffer } from "@/types/database";
import { cleanGameTitle } from "@/utils";
import { logger } from "@/utils/logger";
import { DateTime } from "luxon";
import type { Locator, Page } from "playwright";
import { AmazonBaseScraper, OFFER_URL } from "./base";

export class AmazonGamesScraper extends AmazonBaseScraper {
  getScraperName(): string {
    return "AmazonGames";
  }

  getType(): OfferType {
    return OfferType.GAME;
  }

  override shouldAlwaysHaveOffers(): boolean {
    return true;
  }

  override readOffers(): Promise<Omit<NewOffer, "category">[]> {
    return super.readWebOffers({
      offersUrl: OFFER_URL,
      offerHandlers: [
        {
          locator:
            '[data-a-target="offer-list-FGWP_FULL"] .item-card__action > a:first-child',
          readOffer: this.readOffer.bind(this),
        },
      ],
      pageReadySelector: ".offer-list__content",
      pageLoadedHook: async (page: Page) => {
        // Switch to the "Games" tab
        const gamesTab = page.locator(
          'button[data-a-target="offer-filter-button-Game"]',
        );
        await gamesTab.click();

        await this.scrollElementToBottom(page, "root");
      },
    });
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
        platform: this.getPlatform(),
        title: cleanGameTitle(baseOffer.title),
        probable_game_name: cleanGameTitle(baseOffer.title),
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
        `${this.getScraperName()}: Failed to read offer: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}

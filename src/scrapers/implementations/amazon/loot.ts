import { OfferType } from "@/types/config";
import type { NewOffer } from "@/types/database";
import { DateTime } from "luxon";
import type { Locator, Page } from "playwright";
import type { CronConfig, OfferHandler } from "../../base/scraper";
import { AmazonBaseScraper, type AmazonRawOffer } from "./base";

interface AmazonLootRawOffer extends AmazonRawOffer {
  gameTitle: string;
}

export class AmazonLootScraper extends AmazonBaseScraper<AmazonLootRawOffer> {
  override getSchedule(): CronConfig[] {
    return [
      { schedule: "0 45 * * * *" }, // Every hour
    ];
  }

  getType(): OfferType {
    return OfferType.LOOT;
  }

  protected override async pageLoadedHook(page: Page): Promise<void> {
    await this.scrollElementToBottom(page, "root");
  }

  getOfferHandlers(page: Page): OfferHandler<AmazonLootRawOffer>[] {
    return [
      {
        locator: page.locator(
          '[data-a-target="offer-list-IN_GAME_LOOT"] .item-card__action > a:first-child',
        ),
        readOffer: this.readRawOffer.bind(this),
        normalizeOffer: this.normalizeOffer.bind(this),
      },
    ];
  }

  private async readRawOffer(
    element: Locator,
  ): Promise<AmazonLootRawOffer | null> {
    try {
      const baseOffer = await this.readBaseRawOffer(element);

      const gameTitle = await element
        .locator(".item-card-details__body p")
        .nth(0)
        .textContent();
      if (!gameTitle) throw new Error("Couldn't find game title");

      return {
        ...baseOffer,
        gameTitle,
      };
    } catch (error) {
      this.logger.error(
        `Failed to read raw offer: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private normalizeOffer(rawOffer: AmazonLootRawOffer): NewOffer {
    const rawtext = {
      title: rawOffer.title,
      gametitle: rawOffer.gameTitle,
      enddate: rawOffer.validTo,
    };

    const validTo = rawOffer.validTo
      ? this.parseDateString(rawOffer.validTo)
      : null;
    const title = `${rawOffer.gameTitle}: ${rawOffer.title}`;

    return {
      source: this.getSource(),
      duration: this.getDuration(),
      type: this.getType(),
      title,
      probable_game_name: rawOffer.gameTitle,
      seen_last: DateTime.now().toISO(),
      seen_first: DateTime.now().toISO(),
      valid_to: validTo?.toISOString() ?? null,
      rawtext: JSON.stringify(rawtext),
      url: rawOffer.url ?? null,
      img_url: rawOffer.imgUrl ?? null,
      category: "", // Will be set by categorization
    };
  }
}

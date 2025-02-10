import { BaseScraper, type CronConfig } from "@/services/scraper/base/scraper";
import {
  OfferDuration,
  OfferPlatform,
  OfferSource,
  OfferType,
} from "@/types/basic";
import type { NewOffer } from "@/types/database";
import { cleanGameTitle } from "@/utils";
import { logger } from "@/utils/logger";

import { DateTime } from "luxon";

const BASE_URL =
  "https://egs-platform-service.store.epicgames.com/api/v2/public/discover/home";

interface MobileDiscoverData {
  data: {
    offers: {
      content: {
        title: string;
        mapping: {
          slug: string;
        };
        media: {
          card16x9?: {
            imageSrc: string;
          };
          card3x4?: {
            imageSrc: string;
          };
        };
        purchase: {
          purchaseType: string;
          purchaseStateEffectiveDate: string;
          discount?: {
            discountEndDate: string;
          };
        }[];
      };
    }[];
    type: string;
  }[];
}

const languageDefaults = {
  locale: "en-US",
  country: "US",
};

export abstract class EpicMobileSraper extends BaseScraper {
  override getSchedule(): CronConfig[] {
    // Epic Games updates their free games every Thursday at 11:00 US/Eastern
    // Check soon after release and a backup check later in the day. Also
    // daily, because in the christmas period they sometimes release games more often.
    return [
      { schedule: "0 5 11 * * *", timezone: "US/Eastern" }, // 17:05 UTC Daily (check soon after release)
      { schedule: "0 5 13 * * *", timezone: "US/Eastern" }, // 19:05 UTC Daily (backup check)
    ];
  }

  getSource(): OfferSource {
    return OfferSource.EPIC;
  }

  getType(): OfferType {
    return OfferType.GAME;
  }

  getDuration(): OfferDuration {
    return OfferDuration.CLAIMABLE;
  }

  override async readOffers(): Promise<Omit<NewOffer, "category">[]> {
    const platform =
      this.getPlatform() === OfferPlatform.ANDROID ? "android" : "ios";

    try {
      const response = await fetch(
        `${BASE_URL}?count=10&country=${languageDefaults.country}&locale=${languageDefaults.locale}&platform=${platform}&start=0&store=EGS`,
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status.toFixed()}`);
      }

      const data = (await response.json()) as MobileDiscoverData;
      return this.parseOffers(data);
    } catch (error) {
      if (error instanceof Error) {
        logger.error("Error fetching free games:", error.message);
      } else {
        logger.error("Unknown error occurred while fetching free games");
      }
      return [];
    }
  }

  protected override shouldAlwaysHaveOffers(): boolean {
    return true;
  }

  private parseOffers(data: MobileDiscoverData): Omit<NewOffer, "category">[] {
    // Find the freeGame section
    const freeGameSection = data.data.find(
      (section) => section.type === "freeGame",
    );

    if (!freeGameSection) {
      return [];
    }

    return freeGameSection.offers
      .filter((offer) => {
        // Find the claim purchase type with a discount
        const claimPurchase = offer.content.purchase.find(
          (p) => p.purchaseType === "Claim" && p.discount,
        );
        return !!claimPurchase;
      })
      .map((offer) => {
        const claimPurchase = offer.content.purchase.find(
          (p) => p.purchaseType === "Claim" && p.discount,
        );

        if (!claimPurchase?.discount) {
          throw new Error("Claim purchase with discount not found");
        }

        const res: Omit<NewOffer, "category"> = {
          source: this.getSource(),
          duration: this.getDuration(),
          type: this.getType(),
          platform: this.getPlatform(),
          title: cleanGameTitle(offer.content.title),
          probable_game_name: cleanGameTitle(offer.content.title),
          seen_last: DateTime.now().toISO(),
          seen_first: DateTime.now().toISO(),
          valid_to: DateTime.fromISO(
            claimPurchase.discount.discountEndDate,
          ).toISO(),
          rawtext: JSON.stringify({
            title: offer.content.title,
          }),
          url: `https://store.epicgames.com/en-US/p/${offer.content.mapping.slug}`,
          img_url: this.getMainImage(offer),
        };

        console.log(res);
        return res;
      });
  }

  private getMainImage(offer: {
    content: {
      media: {
        card16x9?: { imageSrc: string };
        card3x4?: { imageSrc: string };
      };
    };
  }): string {
    const { media } = offer.content;
    return media.card16x9?.imageSrc ?? media.card3x4?.imageSrc ?? "";
  }
}

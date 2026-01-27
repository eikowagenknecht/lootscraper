/**
 * Epic Games API Scraper (REST endpoint)
 *
 * This scraper uses the simpler REST endpoint at store-site-backend-static.ak.epicgames.com
 * which has less strict Cloudflare protection and works more reliably with plain fetch().
 *
 * Previous implementation used the GraphQL endpoint at store.epicgames.com/graphql with
 * Apollo Client, but that endpoint started returning 403 errors due to Cloudflare's
 * bot protection. The old GraphQL-based implementation is preserved in epicApiGraphql.ts
 * for reference.
 */
import { DateTime } from "luxon";

import type { CronConfig } from "@/services/scraper/base/scraper";
import type { NewOffer } from "@/types/database";

import { BaseScraper } from "@/services/scraper/base/scraper";
import { OfferDuration, OfferPlatform, OfferSource, OfferType } from "@/types/basic";
import { cleanGameTitle } from "@/utils";
import { logger } from "@/utils/logger";

interface FreeGamesResponse {
  data: {
    Catalog: {
      searchStore: {
        elements: RawOffer[];
      };
    };
  };
}

interface RawOffer {
  __typename: string;
  title: string;
  productSlug: string | null;
  effectiveDate: string;
  expiryDate: string | null;
  customAttributes:
    | {
        __typename: string;
        key: string;
        value: string;
      }[]
    | null;
  keyImages: {
    __typename: string;
    type: string;
    url: string;
  }[];
  price: {
    __typename: string;
    totalPrice: {
      __typename: string;
      discountPrice: number;
      originalPrice: number;
      currencyCode: string;
    };
  };
  promotions: {
    __typename: string;
    promotionalOffers:
      | {
          __typename: string;
          promotionalOffers: {
            __typename: string;
            startDate: string;
            endDate: string;
            discountSetting: {
              __typename: string;
              discountType: string;
              discountPercentage: number;
            };
          }[];
        }[]
      | null;
  } | null;
  offerMappings:
    | {
        __typename: string;
        pageSlug: string;
        pageType: string;
      }[]
    | null;
  catalogNs: {
    mappings:
      | {
          __typename: string;
          pageSlug: string;
          pageType: string;
        }[]
      | null;
  } | null;
}

export class EpicGamesApiScraper extends BaseScraper {
  override getSchedule(): CronConfig[] {
    // Epic Games updates their free games every Thursday at 11:00 US/Eastern
    // Check soon after release and a backup check later in the day. Also
    // daily, because in the christmas period they sometimes release games more often.
    return [
      { schedule: "0 5 11 * * *", timezone: "US/Eastern" }, // 17:05 UTC Daily (check soon after release)
      { schedule: "0 5 13 * * *", timezone: "US/Eastern" }, // 19:05 UTC Daily (backup check)
    ];
  }

  getScraperName(): string {
    return "EpicGamesApi";
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

  override getPlatform(): OfferPlatform {
    return OfferPlatform.PC;
  }

  override async readOffers(): Promise<Omit<NewOffer, "category">[]> {
    // Use the simpler REST endpoint which has less Cloudflare protection
    const response = await fetch(
      "https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=en-US&country=US&allowCountries=US",
      {
        headers: {
          Accept: "application/json",
          "Accept-Language": "en-US,en;q=0.9",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        },
      },
    );

    if (!response.ok) {
      logger.error(`Epic API returned ${response.status.toString()}: ${response.statusText}`);
      throw new Error(`Epic API returned ${response.status.toString()}`);
    }

    const apiResponse = (await response.json()) as unknown;

    if (
      !apiResponse ||
      typeof apiResponse !== "object" ||
      !("data" in apiResponse) ||
      !apiResponse.data
    ) {
      logger.error(
        `No data returned from Epic Games API. Response: ${JSON.stringify(apiResponse)}`,
      );
      throw new Error("No data returned from Epic Games API");
    }

    const typedResponse = apiResponse as FreeGamesResponse;

    return this.parseOffers(typedResponse.data);
  }

  protected override shouldAlwaysHaveOffers(): boolean {
    return true;
  }

  private parseOffers(data: FreeGamesResponse["data"]): Omit<NewOffer, "category">[] {
    const rawOffers: RawOffer[] = data.Catalog.searchStore.elements;

    return rawOffers
      .filter((offer) => {
        const isFree = offer.price.totalPrice.discountPrice === 0;
        const { startDate, endDate } = this.getPromotionalDates(offer);
        const productSlug = offer.productSlug;
        const offerMappingSlug =
          offer.offerMappings && offer.offerMappings.length > 0
            ? offer.offerMappings[0]?.pageSlug
            : null;
        const catalogSlug =
          offer.catalogNs?.mappings && offer.catalogNs.mappings.length > 0
            ? offer.catalogNs.mappings[0]?.pageSlug
            : null;

        const hasRequiredData =
          offer.title &&
          (productSlug ?? offerMappingSlug ?? catalogSlug) &&
          offer.keyImages.length > 0 &&
          startDate !== null &&
          endDate !== null;

        return isFree && hasRequiredData;
      })
      .map((offer) => {
        const { startDate, endDate } = this.getPromotionalDates(offer);

        let slug =
          offer.offerMappings?.[0]?.pageSlug ??
          offer.productSlug ??
          offer.catalogNs?.mappings?.[0]?.pageSlug ??
          "";
        if (slug !== "") {
          slug = `p/${slug}`;
        }
        const res: Omit<NewOffer, "category"> = {
          source: this.getSource(),
          duration: this.getDuration(),
          type: this.getType(),
          platform: this.getPlatform(),
          title: cleanGameTitle(offer.title),
          probable_game_name: cleanGameTitle(offer.title),
          seen_last: DateTime.now().toISO(),
          seen_first: DateTime.now().toISO(),
          rawtext: JSON.stringify({
            title: offer.title,
          }),
          valid_from: startDate ? DateTime.fromISO(startDate).toISO() : null,
          valid_to: endDate ? DateTime.fromISO(endDate).toISO() : null,
          url: `https://store.epicgames.com/en-US/${slug}`,
          img_url: this.getMainImage(offer),
        };

        return res;
      });
  }

  private getPromotionalDates(offer: RawOffer) {
    const res: { startDate: string | null; endDate: string | null } = {
      startDate: null,
      endDate: null,
    };

    if (!offer.promotions?.promotionalOffers) {
      return res;
    }

    for (const promo of offer.promotions.promotionalOffers) {
      for (const subPromo of promo.promotionalOffers) {
        if (
          subPromo.startDate &&
          subPromo.endDate &&
          subPromo.discountSetting.discountPercentage === 0
        ) {
          res.startDate = subPromo.startDate;
          res.endDate = subPromo.endDate;
        }
      }
    }

    return res;
  }

  private getMainImage(offer: RawOffer): string {
    const wideImage = offer.keyImages.find((img) => img.type === "OfferImageWide");
    const tallImage = offer.keyImages.find((img) => img.type === "OfferImageTall");
    return (wideImage?.url ?? tallImage?.url ?? offer.keyImages[0]?.url) || "";
  }
}

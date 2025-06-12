import { BaseScraper, type CronConfig } from "@/services/scraper/base/scraper";
import {
  OfferDuration,
  OfferPlatform,
  OfferSource,
  OfferType,
} from "@/types/basic";
import type { NewOffer } from "@/types/database";
import { cleanGameTitle } from "@/utils";
import {
  ApolloClient,
  type DefaultOptions,
  InMemoryCache,
  gql,
} from "@apollo/client/core";
import { DateTime } from "luxon";

const BASE_URL = "https://graphql.epicgames.com/graphql";

interface CatalogData {
  Catalog: {
    __typename: string;
    searchStore: {
      __typename: string;
      elements: RawOffer[];
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

// This seems to be indirectly queried by
// https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=en-US&country=US&allowCountries=US
// More queries can be found on https://github.com/SD4RK/epicstore_api/blob/master/epicstore_api/queries.py
const FREEGAMES_QUERY = gql`
  query freeGamesQuery(
    $count: Int
    $country: String!
    $locale: String
    $itemNs: String
    $start: Int
    $tag: String
  ) {
    Catalog {
      searchStore(
        category: "freegames"
        count: $count
        country: $country
        locale: $locale
        itemNs: $itemNs
        sortBy: "title"
        sortDir: "asc"
        start: $start
        tag: $tag
      ) {
        elements {
          title
          effectiveDate
          expiryDate
          viewableDate
          productSlug
          keyImages {
            type
            url
          }
          customAttributes {
            key
            value
          }
          price(country: $country) @include(if: true) {
            totalPrice {
              discountPrice
              originalPrice
              currencyCode
            }
          }
          catalogNs {
            mappings(pageType: "productHome") {
              pageSlug
              pageType
            }
          }
          offerMappings {
            pageSlug
            pageType
          }
          promotions @include(if: true) {
            promotionalOffers {
              promotionalOffers {
                startDate
                endDate
                discountSetting {
                  discountType
                  discountPercentage
                }
              }
            }
          }
        }
      }
    }
  }
`;

const languageDefaults = {
  locale: "en-US",
  country: "US",
};

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
    const client = this.createClient();
    const response = await client.query<CatalogData, { count: number }>({
      query: FREEGAMES_QUERY,
      variables: { count: 1000 },
      errorPolicy: "all",
    });

    return this.parseOffers(response.data);
  }

  protected override shouldAlwaysHaveOffers(): boolean {
    return true;
  }

  private createClient() {
    const defaultClientOptions: DefaultOptions = {
      query: {
        variables: languageDefaults,
      },
    };

    const client = new ApolloClient({
      uri: BASE_URL,
      cache: new InMemoryCache(),
      defaultOptions: defaultClientOptions,
    });
    return client;
  }

  private parseOffers(data: CatalogData): Omit<NewOffer, "category">[] {
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
    const wideImage = offer.keyImages.find(
      (img) => img.type === "OfferImageWide",
    );
    const tallImage = offer.keyImages.find(
      (img) => img.type === "OfferImageTall",
    );
    return (wideImage?.url ?? tallImage?.url ?? offer.keyImages[0]?.url) || "";
  }
}

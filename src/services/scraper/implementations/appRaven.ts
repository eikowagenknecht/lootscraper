import { ApolloClient, gql, InMemoryCache } from "@apollo/client/core";
import { HttpLink } from "@apollo/client/link/http";
import { DateTime } from "luxon";

import type { CronConfig } from "@/services/scraper/base/scraper";
import type { NewOffer } from "@/types/database";

import { BaseScraper } from "@/services/scraper/base/scraper";
import { OfferDuration, OfferPlatform, OfferSource, OfferType } from "@/types/basic";
import { cleanGameTitle } from "@/utils";

const BASE_URL = "https://appraven.net/appraven/graphql";

export type Device = "IPHONE" | "IPAD" | "APPLE_TV";

interface App {
  __typename: "App";
  id: string;
  title: string;
  artworkUrl: string;
  priceTier: number;
  rating: number;
  ratingCount: number;
  game: boolean;
  arcade: boolean;
  onStore: boolean;
  hasInAppPurchases: boolean;
  devices: Device[];
}

interface AppActivityPriceChange {
  __typename: "AppActivityPriceChange";
  id: string;
  timestamp: string;
  app: App;
}

interface AppsOnSaleData {
  appsOnSale: {
    __typename: "Slice_AppActivity";
    hasNext: boolean;
    content: AppActivityPriceChange[];
  };
}

const VARIABLES = {
  miniFilter: {
    genreId: 6014,
    price: "FREE",
    ratingCount: 10,
  },
  page: 0,
  rareOnly: false,
};

const QUERY = gql`
  query GetAppsOnSale($rareOnly: Boolean!, $miniFilter: MiniFilterInput!, $page: Int!) {
    appsOnSale(rareOnly: $rareOnly, miniFilter: $miniFilter, page: $page) {
      __typename
      hasNext
      content {
        __typename
        id
        timestamp
        ... on AppActivityPriceChange {
          app {
            id
            title
            artworkUrl
            priceTier
            rating
            ratingCount
            game
            arcade
            onStore
            hasInAppPurchases
            devices
          }
        }
      }
    }
  }
`;

export class AppRavenGamesScraper extends BaseScraper {
  override getSchedule(): CronConfig[] {
    // Run once a day only to avoid causing too much load on the server
    return [
      { schedule: "0 0 12 * * *" }, // 12:00 UTC Daily
    ];
  }

  getScraperName(): string {
    return "AppRavenGames";
  }

  getSource(): OfferSource {
    return OfferSource.APPLE;
  }

  getType(): OfferType {
    return OfferType.GAME;
  }

  getDuration(): OfferDuration {
    return OfferDuration.CLAIMABLE;
  }

  override getPlatform(): OfferPlatform {
    return OfferPlatform.IOS;
  }

  override async readOffers(): Promise<Omit<NewOffer, "category">[]> {
    const client = this.createClient();
    const response = await client.query<AppsOnSaleData>({
      query: QUERY,
      variables: VARIABLES,
    });

    if (!response.data) {
      throw new Error("No data returned from AppRaven API");
    }

    return this.parseOffers(response.data);
  }

  protected override shouldAlwaysHaveOffers(): boolean {
    return true;
  }

  private createClient() {
    const client = new ApolloClient({
      link: new HttpLink({
        uri: BASE_URL,
      }),
      cache: new InMemoryCache(),
    });
    return client;
  }

  private parseOffers(data: AppsOnSaleData): Omit<NewOffer, "category">[] {
    const rawOffers = data.appsOnSale.content;

    return rawOffers.map((offer) => {
      const app = offer.app;
      return {
        source: this.getSource(),
        type: this.getType(),
        duration: this.getDuration(),
        platform: this.getPlatform(),
        title: cleanGameTitle(app.title),
        probable_game_name: cleanGameTitle(app.title),
        seen_last: DateTime.now().toISO(),
        seen_first: DateTime.now().toISO(),
        rawtext: JSON.stringify(offer),
        url: `https://appraven.net/app/${app.id}`,
        valid_from: DateTime.fromISO(offer.timestamp).toISO(),
        valid_to: null,
        img_url: app.artworkUrl.replace("{w}x{h}{c}.{f}", "256x256.png"),
      };
    });
  }
}

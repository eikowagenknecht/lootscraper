/**
 * Steam Points Shop Scraper
 *
 * Uses the public ILoyaltyRewardsService/QueryRewardItems Web API that backs
 * the Steam Points Shop (https://store.steampowered.com/points/shop/). During
 * seasonal sales and events, Valve offers some items (stickers, animated
 * avatars, frames, etc.) for 0 points, which makes them free to claim.
 *
 * The API cannot filter or sort by price (those parameters are ignored for
 * unauthenticated requests), but it always returns definitions ordered by
 * creation time. Free promotional items are created shortly before their
 * event, so scanning the most recently created definitions is sufficient to
 * find them. Outside of events this scraper usually finds no offers.
 */
import { DateTime } from "luxon";

import type { CronConfig } from "@/services/scraper/base/scraper";
import { BaseScraper } from "@/services/scraper/base/scraper";
import { OfferDuration, OfferPlatform, OfferSource, OfferType } from "@/types/basic";
import type { NewOffer } from "@/types/database";
import { logger } from "@/utils/logger";

const API_URL = "https://api.steampowered.com/ILoyaltyRewardsService/QueryRewardItems/v1/";
const PAGE_SIZE = 500;
// Free promotions only last a few weeks and their definitions are created
// shortly before the event, so definitions created earlier than this can be
// skipped. The generous margin is cheap (one request per 500 definitions).
// The page limit is a safety net against runaway pagination if the API ever
// stops honoring the cursor.
const MAX_DEFINITION_AGE_DAYS = 180;
const MAX_PAGES = 30;

// ECommunityItemClass, see https://partner.steamgames.com/doc/store/points
// Class 0 is used for auto-generated sale bundles, which are internal
// containers and not claimable items, so it is intentionally missing here.
const COMMUNITY_ITEM_CLASSES: Record<number, string> = {
  1: "Badge",
  2: "Trading Card",
  3: "Profile Background",
  4: "Emoticon",
  5: "Booster Pack",
  6: "Consumable",
  7: "Game Goo",
  8: "Profile Modifier",
  9: "Scene",
  10: "Salien Item",
  11: "Sticker",
  12: "Chat Effect",
  13: "Mini Profile Background",
  14: "Avatar Frame",
  15: "Animated Avatar",
  16: "Steam Deck Keyboard Skin",
  17: "Steam Deck Startup Movie",
};

interface RewardItem {
  appid: number;
  defid: number;
  type: number;
  community_item_class: number;
  point_cost: string;
  timestamp_created: number;
  timestamp_updated: number;
  timestamp_available: number;
  timestamp_available_end: number;
  active: boolean;
  internal_description: string;
  community_item_data?: {
    item_name?: string;
    item_title?: string;
    item_description?: string;
    item_image_small?: string;
    item_image_large?: string;
    animated?: boolean;
  };
}

interface QueryRewardItemsResponse {
  response: {
    definitions?: RewardItem[];
    total_count?: number;
    count?: number;
    next_cursor?: string;
  };
}

export class SteamPointsShopScraper extends BaseScraper {
  override getSchedule(): CronConfig[] {
    // Free items stay claimable for days to weeks, so once a day is enough.
    // Steam sales and events usually start at 10:00 Pacific, so check
    // shortly after that.
    return [{ schedule: "0 30 10 * * *", timezone: "US/Pacific" }];
  }

  getScraperName(): string {
    return "SteamPointsShop";
  }

  getSource(): OfferSource {
    return OfferSource.STEAM;
  }

  getType(): OfferType {
    return OfferType.POINTS;
  }

  getDuration(): OfferDuration {
    return OfferDuration.CLAIMABLE;
  }

  override getPlatform(): OfferPlatform {
    return OfferPlatform.PC;
  }

  override async readOffers(): Promise<Omit<NewOffer, "category">[]> {
    const freeItems: RewardItem[] = [];
    const cutoff = DateTime.now().minus({ days: MAX_DEFINITION_AGE_DAYS });

    let cursor = "*";
    for (let page = 0; page < MAX_PAGES; page++) {
      const response = await this.queryRewardItems(cursor);
      const definitions = response.definitions ?? [];
      if (definitions.length === 0) {
        break;
      }

      freeItems.push(...definitions.filter((item) => this.isFreeAndAvailable(item)));

      const oldestCreated = Math.min(...definitions.map((item) => item.timestamp_created));
      if (DateTime.fromSeconds(oldestCreated) < cutoff) {
        break;
      }

      if (!response.next_cursor) {
        break;
      }
      cursor = response.next_cursor;
    }

    return freeItems.map((item) => this.toOffer(item));
  }

  private async queryRewardItems(cursor: string): Promise<QueryRewardItemsResponse["response"]> {
    const url = `${API_URL}?count=${PAGE_SIZE.toFixed(0)}&sort_descending=true&language=english&cursor=${encodeURIComponent(cursor)}`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      logger.warn(`Steam API returned ${response.status.toFixed(0)}: ${response.statusText}`);
      throw new Error(`Steam API returned ${response.status.toFixed(0)}`);
    }

    const apiResponse = (await response.json()) as unknown;

    if (
      !apiResponse ||
      typeof apiResponse !== "object" ||
      !("response" in apiResponse) ||
      !apiResponse.response
    ) {
      logger.warn(`No data returned from Steam API. Response: ${JSON.stringify(apiResponse)}`);
      throw new Error("No data returned from Steam API");
    }

    return (apiResponse as QueryRewardItemsResponse).response;
  }

  private isFreeAndAvailable(item: RewardItem): boolean {
    if (item.point_cost !== "0" || !item.active) {
      return false;
    }

    // Auto-generated sale bundles (class 0) are internal containers, not
    // claimable items.
    if (!(item.community_item_class in COMMUNITY_ITEM_CLASSES)) {
      return false;
    }

    const now = DateTime.now();
    if (item.timestamp_available > 0 && DateTime.fromSeconds(item.timestamp_available) > now) {
      return false;
    }
    if (
      item.timestamp_available_end > 0 &&
      DateTime.fromSeconds(item.timestamp_available_end) < now
    ) {
      return false;
    }

    return this.getItemTitle(item) !== "";
  }

  private toOffer(item: RewardItem): Omit<NewOffer, "category"> {
    const itemTitle = this.getItemTitle(item);
    const className = COMMUNITY_ITEM_CLASSES[item.community_item_class];

    return {
      source: this.getSource(),
      duration: this.getDuration(),
      type: this.getType(),
      platform: this.getPlatform(),
      title: `${itemTitle} (${className})`,
      // Points Shop items are cosmetics, not tied to a game we could look up,
      // so game info enrichment is skipped by leaving this empty.
      probable_game_name: "",
      seen_last: DateTime.now().toISO(),
      seen_first: DateTime.now().toISO(),
      rawtext: JSON.stringify({
        title: itemTitle,
        appid: item.appid,
        defid: item.defid,
      }),
      valid_from:
        item.timestamp_available > 0
          ? DateTime.fromSeconds(item.timestamp_available).toISO()
          : null,
      valid_to:
        item.timestamp_available_end > 0
          ? DateTime.fromSeconds(item.timestamp_available_end).toISO()
          : null,
      url: `https://store.steampowered.com/points/shop/app/${item.appid.toFixed(0)}`,
      img_url: this.getImageUrl(item),
    };
  }

  private getItemTitle(item: RewardItem): string {
    const data = item.community_item_data;
    const title = data?.item_title ?? data?.item_name ?? item.internal_description;

    // Emoticon titles are chat codes like ":roboskull:", the description
    // holds the readable name ("Robo Skull") instead.
    if (/^:.+:$/u.test(title) && data?.item_description) {
      return data.item_description;
    }

    return title;
  }

  private getImageUrl(item: RewardItem): string | null {
    const image =
      item.community_item_data?.item_image_large ?? item.community_item_data?.item_image_small;
    if (!image) {
      return null;
    }
    return `https://cdn.fastly.steamstatic.com/steamcommunity/public/images/items/${item.appid.toFixed(0)}/${image}`;
  }
}

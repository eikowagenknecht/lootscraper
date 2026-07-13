import { DateTime } from "luxon";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { config } from "@/services/config";

import { SteamPointsShopScraper } from "./points";

function makeRewardItem(overrides: Record<string, unknown> = {}) {
  return {
    appid: 4_761_370,
    defid: 458_580,
    type: 1,
    community_item_class: 11,
    point_cost: "0",
    timestamp_created: Math.floor(DateTime.now().minus({ days: 3 }).toSeconds()),
    timestamp_updated: Math.floor(DateTime.now().minus({ days: 3 }).toSeconds()),
    timestamp_available: 0,
    timestamp_available_end: Math.floor(DateTime.now().plus({ days: 7 }).toSeconds()),
    quantity: "1",
    internal_description: "noir_happy",
    active: true,
    community_item_data: {
      item_name: "Noir Happy",
      item_title: "Noir Happy",
      item_image_small: "small.png",
      item_image_large: "large.png",
      animated: false,
      tiled: false,
    },
    usable_duration: 0,
    bundle_discount: 0,
    ...overrides,
  };
}

function mockApiResponse(definitions: Record<string, unknown>[], nextCursor = "") {
  return {
    ok: true,
    json: () => Promise.resolve({ response: { definitions, next_cursor: nextCursor } }),
  };
}

describe("Steam Points Shop Scraper", () => {
  beforeAll(() => {
    config.loadConfig();
  });

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("should map free items to offers and filter out invalid ones", async () => {
    const definitions = [
      makeRewardItem(),
      // Paid item
      makeRewardItem({ defid: 2, point_cost: "100" }),
      // Inactive item
      makeRewardItem({ defid: 3, active: false }),
      // Expired item
      makeRewardItem({
        defid: 4,
        timestamp_available_end: Math.floor(DateTime.now().minus({ days: 1 }).toSeconds()),
      }),
      // Not yet available item
      makeRewardItem({
        defid: 5,
        timestamp_available: Math.floor(DateTime.now().plus({ days: 1 }).toSeconds()),
      }),
      // Auto-generated sale bundle (class 0)
      makeRewardItem({ defid: 6, community_item_class: 0 }),
    ];
    vi.mocked(fetch).mockResolvedValue(mockApiResponse(definitions) as unknown as Response);

    const scraper = new SteamPointsShopScraper(config.get());
    const offers = await scraper.readOffers();

    expect(offers).toHaveLength(1);
    const offer = offers[0];
    expect(offer.title).toBe("Noir Happy (Sticker)");
    expect(offer.probable_game_name).toBe("");
    expect(offer.url).toBe("https://store.steampowered.com/points/shop/app/4761370");
    expect(offer.img_url).toBe(
      "https://cdn.fastly.steamstatic.com/steamcommunity/public/images/items/4761370/large.png",
    );
    expect(offer.valid_to).toBeTruthy();
  });

  test("should use the readable description for emoticon chat codes", async () => {
    const definitions = [
      makeRewardItem({
        community_item_class: 4,
        community_item_data: {
          item_name: ":roboskull:",
          item_title: ":roboskull:",
          item_description: "Robo Skull",
          item_image_large: "large.png",
        },
      }),
    ];
    vi.mocked(fetch).mockResolvedValue(mockApiResponse(definitions) as unknown as Response);

    const scraper = new SteamPointsShopScraper(config.get());
    const offers = await scraper.readOffers();

    expect(offers).toHaveLength(1);
    expect(offers[0].title).toBe("Robo Skull (Emoticon)");
  });

  test("should stop paginating when definitions are older than the cutoff", async () => {
    const oldItem = makeRewardItem({
      point_cost: "100",
      timestamp_created: Math.floor(DateTime.now().minus({ days: 365 }).toSeconds()),
    });
    vi.mocked(fetch).mockResolvedValue(
      mockApiResponse([oldItem], "next-page-cursor") as unknown as Response,
    );

    const scraper = new SteamPointsShopScraper(config.get());
    await scraper.readOffers();

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test("should throw when the API returns an error", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    } as unknown as Response);

    const scraper = new SteamPointsShopScraper(config.get());
    await expect(scraper.readOffers()).rejects.toThrow("Steam API returned 500");
  });
});

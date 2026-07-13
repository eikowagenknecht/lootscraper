import { beforeAll, describe, expect, test } from "vitest";

import { config } from "@/services/config";

import { SteamPointsShopScraper } from "./points";

describe("Steam Points Shop Scraper Contract Tests", () => {
  beforeAll(() => {
    config.loadConfig();
  });

  test("should scrape points shop offers without errors", async () => {
    const scraper = new SteamPointsShopScraper(config.get());
    const results = await scraper.scrape();

    // Free items only exist during sales and events, so an empty result is
    // valid. When offers are found, they need to be complete.
    for (const result of results) {
      expect(result.title).toBeTruthy();
      expect(result.url).toMatch(/^https:\/\/store\.steampowered\.com\/points\/shop\//u);
      if (result.img_url) {
        expect(result.img_url).toMatch(/^https:\/\//u);
      }
    }
  });

  test("API returns reward item definitions", async () => {
    const response = await fetch(
      "https://api.steampowered.com/ILoyaltyRewardsService/QueryRewardItems/v1/?count=10&sort_descending=true",
    );
    expect(response.ok).toBe(true);

    const data = (await response.json()) as {
      response: { definitions?: { defid: number; point_cost: string }[] };
    };
    expect(data.response.definitions).toBeDefined();
    expect(data.response.definitions?.length).toBeGreaterThan(0);
    expect(data.response.definitions?.[0].point_cost).toBeDefined();
  });
});

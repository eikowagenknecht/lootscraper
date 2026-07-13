import { beforeAll, describe, expect, test } from "vitest";

import { browserService } from "@/services/browser";
import { config } from "@/services/config";

import { FabAssetsScraper } from "./fab";

describe("Fab Assets Scraper Contract Tests", () => {
  beforeAll(async () => {
    config.loadConfig();
    await browserService.initialize(config.get());
  });

  test("should scrape limited-time free assets correctly", { timeout: 120_000 }, async () => {
    const scraper = new FabAssetsScraper(config.get());
    const results = await scraper.scrape();

    // Fab always has a running "Limited-Time Free" rotation.
    expect(results.length).toBeGreaterThan(0);

    for (const result of results) {
      expect(result.title).toBeTruthy();
      expect(result.url).toMatch(/^https:\/\/www\.fab\.com\/listings\//u);
      expect(result.img_url).toMatch(/^https:\/\//u);
      expect(result.valid_to).toBeTruthy();
    }
  });
});

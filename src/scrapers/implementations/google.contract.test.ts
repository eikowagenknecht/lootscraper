import { browser } from "@/services/browser";
import { config } from "@/services/config";
import { beforeAll, describe, expect, test } from "vitest";
import { GoogleGamesScraper } from "./google";

describe("Google Play Games Scraper Contract Tests", () => {
  beforeAll(async () => {
    config.loadConfig();
    await browser.initialize(config.get());
  });

  test("should scrape free games correctly", async () => {
    const scraper = new GoogleGamesScraper(browser.getContext(), config.get());
    const results = await scraper.scrape();

    expect(results.length).toBeGreaterThan(0);

    for (const result of results) {
      expect(result.title).toBeDefined();
      expect(result.url).toBeDefined();
      expect(result.url).toMatch(/^https:\/\/appagg\.com\//);
      expect(result.img_url).toBeDefined();
      expect(result.img_url).toMatch(/^https:\/\//);
    }
  });
});

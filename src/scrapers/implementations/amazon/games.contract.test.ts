import { browser } from "@/services/browser";
import { config } from "@/services/config";
import { DateTime } from "luxon";
import { beforeAll, describe, expect, test } from "vitest";
import { AmazonGamesScraper } from "./games";

describe("Amazon Games Scraper Contract Tests", () => {
  beforeAll(async () => {
    config.loadConfig();
    await browser.initialize(config.get());
  });

  test("should scrape games correctly", { timeout: 120000 }, async () => {
    const scraper = new AmazonGamesScraper(browser.getContext(), config.get());
    const results = await scraper.scrape();

    expect(results.length).toBeGreaterThan(0);

    for (const result of results) {
      expect(result.title).toBeDefined();
      expect(result.valid_to).toBeDefined();
      expect(result.img_url).toBeDefined();
      expect(result.img_url).toMatch(/^https:\/\//);

      if (!result.valid_to) {
        continue;
      }

      // Valid to date should be in the future
      expect(DateTime.fromISO(result.valid_to).toMillis()).toBeGreaterThan(
        DateTime.now().toMillis(),
      );
    }
  });
});

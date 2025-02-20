import { browserService } from "@/services/browser";
import { config } from "@/services/config";
import { DateTime } from "luxon";
import { beforeAll, describe, expect, test } from "vitest";
import { AmazonLootScraper } from "./loot";

const runThis =
  process.env.VSCODE_PID !== undefined ||
  process.env.VITEST_MODE === "contract";

describe.skipIf(!runThis)("Amazon Loot Scraper Contract Tests", () => {
  beforeAll(async () => {
    config.loadConfig();
    await browserService.initialize(config.get());
  });

  test("should scrape loot correctly", { timeout: 120000 }, async () => {
    const scraper = new AmazonLootScraper(config.get());
    const results = await scraper.scrape();

    expect(results.length).toBeGreaterThan(0);

    for (const result of results) {
      expect(result.probable_game_name).toBeDefined();
      expect(result.title).toBeDefined();
      expect(result.valid_to).toBeDefined();
      expect(result.img_url).toBeDefined();
      expect(result.img_url).toMatch(/^https:\/\//);

      if (result.url) {
        expect(result.url).toMatch(/^https:\/\/gaming\.amazon\.com/);
      }

      if (!result.valid_to) {
        continue;
      }

      expect(DateTime.fromISO(result.valid_to).toMillis()).toBeGreaterThan(
        DateTime.now().toMillis(),
      );
    }
  });
});

import { beforeAll, describe, expect, test } from "vitest";
import { browserService } from "@/services/browser";
import { config } from "@/services/config";
import { GogGamesAlwaysFreeScraper } from "./alwaysfree";

const runThis =
  process.env.VSCODE_PID !== undefined ||
  process.env.VITEST_MODE === "contract";

describe.skipIf(!runThis)(
  "GOG Always Free Games Scraper Contract Tests",
  () => {
    beforeAll(async () => {
      config.loadConfig();
      await browserService.initialize(config.get());
    });

    test("should scrape always-free games correctly", async () => {
      const scraper = new GogGamesAlwaysFreeScraper(config.get());
      const results = await scraper.scrape();

      expect(results.length).toBeGreaterThan(40);

      for (const result of results) {
        expect(result.title).toBeDefined();
        expect(result.url).toBeDefined();
        expect(result.url).toMatch(/^https:\/\/www\.gog\.com\//);
        expect(result.img_url).toBeDefined();
        expect(result.img_url).toMatch(/^https:\/\//);
        expect(result.valid_to).toBeNull();
      }
    });
  },
);

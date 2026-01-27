import { beforeAll, describe, expect, test } from "vitest";

import { browserService } from "@/services/browser";
import { config } from "@/services/config";

import { UbisoftGamesScraper } from "./ubisoft";

const runThis = process.env.VSCODE_PID !== undefined || process.env.VITEST_MODE === "contract";

describe.skipIf(!runThis)("Ubisoft Games Scraper Contract Tests", () => {
  beforeAll(async () => {
    config.loadConfig();
    await browserService.initialize(config.get());
  });

  test("should scrape free games correctly", async () => {
    const scraper = new UbisoftGamesScraper(config.get());
    const results = await scraper.scrape();

    expect(results.length).toBeGreaterThan(0);

    for (const result of results) {
      expect(result.valid_to).toBeDefined();
      expect(result.title).toBeDefined();
      expect(result.url).toBeDefined();
      expect(result.url).toMatch(/^https:\/\/store\.ubi\.com\//);
      expect(result.img_url).toBeDefined();
      expect(result.img_url).toMatch(/^https:\/\//);
    }
  });
});

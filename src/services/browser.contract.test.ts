import { browser } from "@/services/browser";
import { config } from "@/services/config";
import { beforeAll, describe, expect, it } from "vitest";

describe("Browser Contract Tests", () => {
  beforeAll(async () => {
    config.loadConfig();
    await browser.initialize(config.get());
  });

  it("should load basic page correctly", async () => {
    const context = browser.getContext();
    const page = await context.newPage();
    const response = await page.goto("https://google.com/", { timeout: 30000 });
    expect(response?.status()).toBe(200);
    await page.close();
  });
});

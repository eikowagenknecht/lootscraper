import { browserService } from "@/services/browser";
import { config } from "@/services/config";
import { beforeAll, describe, expect, it } from "vitest";

const runThis =
  process.env.VSCODE_PID !== undefined ||
  process.env.VITEST_MODE === "contract";

describe.skipIf(!runThis)("Browser Contract Tests", () => {
  beforeAll(async () => {
    config.loadConfig();
    await browserService.initialize(config.get());
  });

  it("should load basic page correctly", async () => {
    const context = browserService.getContext();
    const page = await context.newPage();
    const response = await page.goto("https://google.com/", { timeout: 30000 });
    expect(response?.status()).toBe(200);
    await page.close();
  });
});

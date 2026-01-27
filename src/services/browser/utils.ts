import type { Page } from "playwright";

import { DateTime } from "luxon";
import { resolve } from "node:path";

import { logger } from "@/utils/logger";
import { getDataPath } from "@/utils/path";

/**
 * Scroll down to the bottom of the current page.
 * Useful for pages with infinite scrolling.
 * @param page The Playwright page to scroll.
 */
export async function scrollPageToBottom(page: Page): Promise<void> {
  // Get scroll height
  let height = await page.evaluate("document.body.scrollHeight");
  let scrollCount = 0;

  // Scroll for max. 100 times.
  // If it doesn't reach the bottom befor,e something is wrong.
  while (scrollCount < 100) {
    // Wait to load page. We do this first to give the page time for the initial load.
    await page.waitForTimeout(1000);
    // Scroll down to bottom
    await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");

    // Calculate new scroll height and compare with last scroll height
    const newHeight = await page.evaluate("document.body.scrollHeight");
    if (newHeight === height) {
      break;
    }
    height = newHeight;
    scrollCount++;
  }

  // Final mouse wheel movements (up and down) to trigger any lazy loading
  await page.waitForTimeout(1000);
  await page.mouse.wheel(0, -100);

  await page.waitForTimeout(1000);
  await page.mouse.wheel(0, 100);

  // One final wait so the content may load
  await page.waitForTimeout(1000);
}

export async function takeScreenshot(page: Page, prefix = "", suffix = ""): Promise<void> {
  try {
    const filename = resolve(
      getDataPath(),
      "screenshots",
      `${prefix}_${DateTime.now().toFormat("yyyyMMdd_HHmmss")}_${suffix}.png`,
    );

    await page.screenshot({
      path: filename,
      fullPage: true,
    });
  } catch (error) {
    logger.error(
      `Failed to take screenshot: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

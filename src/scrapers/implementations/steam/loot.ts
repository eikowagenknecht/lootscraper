import type { CronConfig } from "@/scrapers/base/scraper";
import { OfferType } from "@/types/config";
import type { Locator, Page } from "playwright";
import { SteamBaseScraper } from "./base";

export class SteamLootScraper extends SteamBaseScraper {
  override getSchedule(): CronConfig[] {
    return [
      { schedule: "0 25,55 * * * *" }, // Every 30 minutes
    ];
  }

  getType(): OfferType {
    return OfferType.LOOT;
  }

  getSteamCategory(): number {
    return 21; // DLC
  }

  getValidtextLocator(page: Page): Locator {
    return page.locator(".game_purchase_discount_quantity");
  }
}

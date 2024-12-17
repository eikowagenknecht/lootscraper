import type { CronConfig } from "@/scrapers/base/scraper";
import { OfferType } from "@/types/config";
import type { Locator, Page } from "playwright";
import { SteamBaseScraper } from "./base";

export class SteamGamesScraper extends SteamBaseScraper {
  override getSchedule(): CronConfig[] {
    return [
      { schedule: "0 20,50 * * * *" }, // Every 30 minutes
    ];
  }

  getType(): OfferType {
    return OfferType.GAME;
  }

  getSteamCategory(): number {
    return 998; // Games
  }

  getValidtextLocator(page: Page): Locator {
    return page.locator(".game_purchase_discount_countdown");
  }
}

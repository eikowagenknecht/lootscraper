import type { Locator, Page } from "playwright";
import { OfferType } from "@/types/basic";
import { SteamBaseScraper } from "./base";

export class SteamGamesScraper extends SteamBaseScraper {
  getScraperName(): string {
    return "SteamGames";
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

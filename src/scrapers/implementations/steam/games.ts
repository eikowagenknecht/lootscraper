import { OfferType } from "@/types/config";
import type { Locator, Page } from "playwright";
import { SteamBaseScraper } from "./base";

export class SteamGamesScraper extends SteamBaseScraper {
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

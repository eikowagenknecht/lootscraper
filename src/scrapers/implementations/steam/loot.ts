import { OfferType } from "@/types/basic";
import type { Locator, Page } from "playwright";
import { SteamBaseScraper } from "./base";

export class SteamLootScraper extends SteamBaseScraper {
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

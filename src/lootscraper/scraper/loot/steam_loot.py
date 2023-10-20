from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from lootscraper.common import OfferType
from lootscraper.scraper.loot.steam_base import SteamBaseScraper

if TYPE_CHECKING:
    from playwright.async_api import Locator, Page

logger = logging.getLogger(__name__)


class SteamLootScraper(SteamBaseScraper):
    @staticmethod
    def get_type() -> OfferType:
        return OfferType.LOOT

    def get_steam_category(self) -> int:
        return 21  # DLC

    def get_validtext_locator(self, page: Page) -> Locator:
        return page.locator(".game_purchase_discount_quantity")

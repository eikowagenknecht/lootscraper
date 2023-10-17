from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from lootscraper.common import OfferType
from lootscraper.scraper.loot.steam_base import SteamBaseScraper

if TYPE_CHECKING:
    from playwright.async_api import Locator, Page

logger = logging.getLogger(__name__)


class SteamGamesScraper(SteamBaseScraper):
    @staticmethod
    def get_type() -> OfferType:
        return OfferType.GAME

    def get_steam_category(self: SteamGamesScraper) -> int:
        return 998  # Games

    def get_validtext_locator(self: SteamGamesScraper, page: Page) -> Locator:
        return page.locator(".game_purchase_discount_countdown")

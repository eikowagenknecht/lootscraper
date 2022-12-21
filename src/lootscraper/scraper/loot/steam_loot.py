import logging

from playwright.async_api import Locator, Page

from lootscraper.common import OfferType
from lootscraper.scraper.loot.steam_base import SteamBaseScraper

logger = logging.getLogger(__name__)


class SteamLootScraper(SteamBaseScraper):
    @staticmethod
    def get_type() -> OfferType:
        return OfferType.LOOT

    def get_steam_category(self) -> int:
        return 21  # DLC

    def get_validtext_locator(self, page: Page) -> Locator:
        return page.locator(".game_purchase_discount_quantity")

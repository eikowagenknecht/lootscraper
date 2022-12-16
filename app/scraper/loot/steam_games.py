import logging

from playwright.async_api import Locator, Page

from app.common import OfferType
from app.scraper.loot.steam_base import SteamBaseScraper

logger = logging.getLogger(__name__)


class SteamGamesScraper(SteamBaseScraper):
    @staticmethod
    def get_type() -> OfferType:
        return OfferType.GAME

    def get_steam_category(self) -> int:
        return 998  # Games

    def get_validtext_locator(self, page: Page) -> Locator:
        return page.locator(".game_purchase_discount_countdown")

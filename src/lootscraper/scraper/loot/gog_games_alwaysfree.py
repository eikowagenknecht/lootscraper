from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from lootscraper.common import OfferDuration
from lootscraper.database import Offer
from lootscraper.scraper.loot.gog_base import GogBaseScraper
from lootscraper.scraper.loot.scraper import OfferHandler, RawOffer

if TYPE_CHECKING:
    from playwright.async_api import Locator, Page

logger = logging.getLogger(__name__)

BASE_URL = "https://www.gog.com"
OFFER_URL = BASE_URL + "/partner/free_games"


class GogGamesAlwaysFreeScraper(GogBaseScraper):
    @staticmethod
    def get_duration() -> OfferDuration:
        return OfferDuration.ALWAYS

    def offers_expected(self) -> bool:
        return True

    def get_offers_url(self) -> str:
        return OFFER_URL

    def get_page_ready_selector(self) -> str:
        return ".content.cf"

    def get_offer_handlers(
        self,
        page: Page,
    ) -> list[OfferHandler]:
        return [
            OfferHandler(
                page.locator(".product-row__link"),
                self.read_raw_offer,
                self.normalize_offer,
            ),
        ]

    async def page_loaded_hook(self, page: Page) -> None:
        await GogBaseScraper.switch_to_english(page)

    @staticmethod
    async def read_raw_offer(element: Locator) -> RawOffer:
        title = await element.locator(".product-title__text").text_content()
        if title is None:
            raise ValueError("Couldn't find title.")

        url = await element.get_attribute("href")
        if url is None:
            raise ValueError(f"Couldn't find url for {title}.")
        if not url.startswith("http"):
            url = BASE_URL + url

        img_url = GogGamesAlwaysFreeScraper.sanitize_img_url(
            await element.locator("img").get_attribute("srcset"),
        )
        if img_url is None:
            raise ValueError(f"Couldn't find image for {title}.")

        return RawOffer(
            title=title,
            url=url,
            img_url=img_url,
        )

    def normalize_offer(self, raw_offer: RawOffer) -> Offer:
        rawtext = {
            "title": raw_offer.title,
        }

        return Offer(
            source=GogGamesAlwaysFreeScraper.get_source(),
            duration=GogGamesAlwaysFreeScraper.get_duration(),
            type=GogGamesAlwaysFreeScraper.get_type(),
            title=raw_offer.title,
            probable_game_name=raw_offer.title,
            seen_last=datetime.now(timezone.utc),
            rawtext=rawtext,
            url=raw_offer.url,
            img_url=raw_offer.img_url,
        )

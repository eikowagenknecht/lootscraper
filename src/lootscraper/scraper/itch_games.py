from __future__ import annotations

import logging
from datetime import datetime, timezone

from playwright.async_api import Locator, Page
from playwright.async_api import TimeoutError as PlaywrightTimeoutError

from lootscraper.common import OfferDuration, OfferType, Source
from lootscraper.database import Offer
from lootscraper.scraper.scraper_base import OfferHandler, RawOffer, Scraper

logger = logging.getLogger(__name__)

BASE_URL = "https://itch.io"
OFFER_URL = BASE_URL + "/games/new-and-popular/on-sale"


class ItchGamesScraper(Scraper):
    @staticmethod
    def get_source() -> Source:
        return Source.ITCH

    @staticmethod
    def get_type() -> OfferType:
        return OfferType.GAME

    @staticmethod
    def get_duration() -> OfferDuration:
        return OfferDuration.CLAIMABLE

    def offers_expected(self) -> bool:
        return True

    def get_offers_url(self) -> str:
        return OFFER_URL

    def get_page_ready_selector(self) -> str:
        return ".game_grid_widget .game_cell"

    def get_offer_handlers(self, page: Page) -> list[OfferHandler]:
        return [
            OfferHandler(
                page.locator(
                    ".game_grid_widget .game_cell",
                    has=page.locator(".sale_tag", has_text="100"),
                ),
                self.read_raw_offer,
                self.normalize_offer,
            ),
        ]

    async def page_loaded_hook(self, page: Page) -> None:
        await Scraper.scroll_page_to_bottom(page)

    async def read_raw_offer(self, element: Locator) -> RawOffer:
        # Scroll into view to mage sure the image is loaded
        await element.scroll_into_view_if_needed()

        title = await element.locator("a.title").text_content()
        if title is None:
            raise ValueError("Couldn't find title.")

        url = await element.locator("a.title").get_attribute("href")
        if url is None:
            raise ValueError(f"Couldn't find url for {title}.")
        if not url.startswith("http"):
            url = BASE_URL + url

        # Some games don't have an image.
        try:
            img_url = await element.locator("img").get_attribute("src", timeout=1000)
        except PlaywrightTimeoutError:
            img_url = None

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
            source=ItchGamesScraper.get_source(),
            duration=ItchGamesScraper.get_duration(),
            type=ItchGamesScraper.get_type(),
            title=raw_offer.title,
            probable_game_name=raw_offer.title,
            seen_last=datetime.now(timezone.utc),
            rawtext=rawtext,
            url=raw_offer.url,
            img_url=raw_offer.img_url,
        )

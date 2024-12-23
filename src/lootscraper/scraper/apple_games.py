from __future__ import annotations

import logging
import urllib.parse
from datetime import UTC, datetime
from typing import TYPE_CHECKING

import schedule

from lootscraper.common import OfferDuration, OfferType, Source
from lootscraper.database import Offer
from lootscraper.scraper.scraper_base import OfferHandler, RawOffer, Scraper

if TYPE_CHECKING:
    from playwright.async_api import Locator, Page

logger = logging.getLogger(__name__)

ROOT_URL = "https://appsliced.co/apps/iphone"
SEARCH_PARAMS = {
    "sort": "latest",
    "price": "free",
    "cat[]": 6014,
    "page": 1,
}


class AppleGamesScraper(Scraper):
    @staticmethod
    def get_source() -> Source:
        return Source.APPLE

    @staticmethod
    def get_type() -> OfferType:
        return OfferType.GAME

    @staticmethod
    def get_schedule() -> list[schedule.Job]:
        # Run once per day only to avoid getting blocked
        return [schedule.every().day.at("12:00")]

    @staticmethod
    def get_duration() -> OfferDuration:
        return OfferDuration.CLAIMABLE

    def offers_expected(self) -> bool:
        return True

    def get_offers_url(self) -> str:
        return f"{ROOT_URL}?{urllib.parse.urlencode(SEARCH_PARAMS)}"

    def get_page_ready_selector(self) -> str:
        return "article.app"

    def get_offer_handlers(self, page: Page) -> list[OfferHandler]:
        return [
            OfferHandler(
                page.locator("article.app"),
                self.read_raw_offer,
                self.normalize_offer,
            ),
        ]

    async def read_raw_offer(self, element: Locator) -> RawOffer:
        title = await element.locator(".title a").get_attribute("title")
        if title is None:
            raise ValueError("Couldn't find title.")

        url = await element.locator(".title a").get_attribute("href")
        if url is None:
            raise ValueError(f"Couldn't find url for {title}.")

        img_url = await element.locator(".icon img").get_attribute("src")
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
            source=AppleGamesScraper.get_source(),
            duration=AppleGamesScraper.get_duration(),
            type=AppleGamesScraper.get_type(),
            title=raw_offer.title,
            probable_game_name=raw_offer.title,
            seen_last=datetime.now(UTC),
            rawtext=rawtext,
            url=raw_offer.url,
            img_url=raw_offer.img_url,
        )

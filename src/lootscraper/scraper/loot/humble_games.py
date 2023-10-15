from __future__ import annotations

import logging
import urllib.parse
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING

from lootscraper.browser import get_new_page
from lootscraper.common import Category, OfferDuration, OfferType, Source
from lootscraper.database import Offer
from lootscraper.scraper.loot.scraper import OfferHandler, RawOffer, Scraper

if TYPE_CHECKING:
    from playwright.async_api import Locator, Page

logger = logging.getLogger(__name__)

BASE_URL = "https://humblebundle.com"
SEARCH_URL = BASE_URL + "/store/search"
SEARCH_URL_PARAMS = {
    "sort": "discount",
    "filter": "onsale",
}


@dataclass(kw_only=True)
class HumbleRawOffer(RawOffer):
    valid_for_minutes: int | None = None
    original_price: float | None = None


class HumbleGamesScraper(Scraper):
    @staticmethod
    def get_source() -> Source:
        return Source.HUMBLE

    @staticmethod
    def get_type() -> OfferType:
        return OfferType.GAME

    @staticmethod
    def get_duration() -> OfferDuration:
        return OfferDuration.CLAIMABLE

    def get_offers_url(self: HumbleGamesScraper) -> str:
        return f"{SEARCH_URL}?{urllib.parse.urlencode(SEARCH_URL_PARAMS)}"

    def get_page_ready_selector(self: HumbleGamesScraper) -> str:
        return "li div.discount-amount"

    def get_offer_handlers(self: HumbleGamesScraper, page: Page) -> list[OfferHandler]:
        return [
            OfferHandler(
                page.locator(
                    "li",
                    has=page.locator("div.discount-amount", has_text="100"),
                ),
                self.read_raw_offer,
                self.normalize_offer,
            ),
        ]

    async def read_raw_offer(
        self: HumbleGamesScraper,
        element: Locator,
    ) -> HumbleRawOffer:
        title = await element.locator("span.entity-title").text_content()
        if title is None:
            raise ValueError("Couldn't find title.")

        url = await element.locator("a").get_attribute("href")
        if url is None:
            raise ValueError(f"Couldn't find url for {title}.")
        if not url.startswith("http"):
            url = BASE_URL + url

        img_url = await element.locator("img.entity-image").get_attribute("src")
        if img_url is None:
            raise ValueError(f"Couldn't find image for {title}.")

        raw_offer = HumbleRawOffer(
            title=title,
            url=url,
            img_url=img_url,
        )

        await self.add_details(raw_offer, url)

        return raw_offer

    async def add_details(
        self: HumbleGamesScraper,
        offer: HumbleRawOffer,
        url: str,
    ) -> None:
        async with get_new_page(self.context) as page:
            await page.goto(url, timeout=30000)

            await page.wait_for_selector(".promo-timer-view .js-days")
            days_valid = await page.locator(".promo-timer-view .js-days").text_content()
            hours_valid = await page.locator(
                ".promo-timer-view .js-hours",
            ).text_content()
            minutes_valid = await page.locator(
                ".promo-timer-view .js-minutes",
            ).text_content()

            if days_valid is None or hours_valid is None or minutes_valid is None:
                raise ValueError(f"Couldn't find valid to for {offer.title}.")

            # May throw a ValueError, that's okay and will be handled.
            offer.valid_for_minutes = (
                int(days_valid) * 24 * 60 + int(hours_valid) * 60 + int(minutes_valid)
            )

            original_price = await page.locator(".full-price").text_content()
            if original_price is not None:
                # May throw a ValueError, that's okay and will be handled.
                offer.original_price = float(original_price.removeprefix("€").strip())

    def normalize_offer(self: HumbleGamesScraper, raw_offer: RawOffer) -> Offer:
        if not isinstance(raw_offer, HumbleRawOffer):
            raise TypeError("Wrong type of raw offer.")

        rawtext = {
            "title": raw_offer.title,
        }

        if raw_offer.valid_for_minutes is not None:
            valid_to = datetime.now(tz=timezone.utc) + timedelta(
                minutes=raw_offer.valid_for_minutes,
            )
        else:
            valid_to = None

        if raw_offer.original_price is not None and raw_offer.original_price < 1.0:
            category = Category.CHEAP
        else:
            category = Category.VALID

        return Offer(
            source=HumbleGamesScraper.get_source(),
            duration=HumbleGamesScraper.get_duration(),
            type=HumbleGamesScraper.get_type(),
            category=category,
            title=raw_offer.title,
            probable_game_name=raw_offer.title,
            seen_last=datetime.now(timezone.utc),
            rawtext=rawtext,
            url=raw_offer.url,
            img_url=raw_offer.img_url,
            valid_to=valid_to,
        )

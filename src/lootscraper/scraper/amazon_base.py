from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

import schedule
from playwright.async_api import Error, Locator, TimeoutError

from lootscraper.browser import get_new_page
from lootscraper.common import OfferDuration, Source
from lootscraper.scraper.scraper_base import RawOffer, Scraper

if TYPE_CHECKING:
    from datetime import datetime

BASE_URL = "https://gaming.amazon.com"
OFFER_URL = BASE_URL + "/home"


@dataclass(kw_only=True)
class AmazonRawOffer(RawOffer):
    valid_to: str | None = None


class AmazonBaseScraper(Scraper):
    @staticmethod
    def get_source() -> Source:
        return Source.AMAZON

    @staticmethod
    def get_duration() -> OfferDuration:
        return OfferDuration.CLAIMABLE

    @staticmethod
    def get_schedule() -> list[schedule.Job]:
        return [schedule.every(60).minutes]

    def offers_expected(self) -> bool:
        return True

    def get_offers_url(self) -> str:
        return OFFER_URL

    def get_page_ready_selector(self) -> str:
        return ".offer-list__content"

    @staticmethod
    def is_fake_always(valid_to: datetime | None) -> bool:  # noqa: ARG004
        """Offers on Amazon are never valid forever."""
        return False

    async def read_base_raw_offer(
        self,
        element: Locator,
    ) -> AmazonRawOffer:
        title = await element.locator(
            ".item-card-details__body__primary h3",
        ).text_content()
        if title is None:
            raise ValueError("Couldn't find title.")

        img_url = await element.locator(
            '[data-a-target="card-image"] img',
        ).get_attribute("src")
        if img_url is None:
            raise ValueError(f"Couldn't find image for {title}.")

        url = BASE_URL

        try:
            path = await element.get_attribute("href", timeout=500)
            if path is not None and not path.startswith("http"):
                url += path
        except Error:
            raise ValueError(f"Couldn't find detail page for {title}.") from None

        try:
            valid_to = await self.read_date_from_details_page(url)
        except TimeoutError:
            # Some offers just have no date. That's fine.
            valid_to = None

        return AmazonRawOffer(
            title=title,
            valid_to=valid_to,
            url=url,
            img_url=img_url,
        )

    async def read_date_from_details_page(
        self,
        url: str,
    ) -> str:
        async with get_new_page(self.context) as page:
            await page.goto(url, timeout=30000)

            date = await page.locator(
                ".availability-date span:nth-child(2)",
            ).text_content()
            if date is None:
                raise ValueError("Couldn't find date.")

            return date

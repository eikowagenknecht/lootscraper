from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import TYPE_CHECKING

import schedule

from lootscraper.common import OfferDuration, OfferType, Source
from lootscraper.database import Offer
from lootscraper.scraper.scraper_base import OfferHandler, RawOffer, Scraper

if TYPE_CHECKING:
    from playwright.async_api import Locator, Page

logger = logging.getLogger(__name__)

BASE_URL = "https://store.epicgames.com"
OFFER_URL = BASE_URL + "/en-US/"


@dataclass(kw_only=True)
class EpicRawOffer(RawOffer):
    valid_to: str


class EpicGamesScraper(Scraper):
    @staticmethod
    def get_source() -> Source:
        return Source.EPIC

    @staticmethod
    def get_type() -> OfferType:
        return OfferType.GAME

    @staticmethod
    def get_schedule() -> list[schedule.Job]:
        # Run every day at 11:05 US eastern time (new offers are usually
        # available then) and as a backup every day at 13:00 US eastern time.
        return [
            schedule.every().day.at("11:05", "US/Eastern"),
            schedule.every().day.at("13:00", "US/Eastern"),
        ]

    @staticmethod
    def get_duration() -> OfferDuration:
        return OfferDuration.CLAIMABLE

    def offers_expected(self) -> bool:
        return True

    def get_offers_url(self) -> str:
        return OFFER_URL

    def get_page_ready_selector(self) -> str:
        return "h1"

    def get_offer_handlers(self, page: Page) -> list[OfferHandler]:
        return [
            OfferHandler(
                page.locator('//span[text()="Free Now"]//ancestor::a'),
                self.read_raw_offer,
                self.normalize_offer,
            ),
        ]

    async def page_loaded_hook(self, page: Page) -> None:
        # Scroll to bottom to make free games section load
        await Scraper.scroll_page_to_bottom(self, page)

    async def read_raw_offer(self, element: Locator) -> RawOffer:
        # Scroll element into view to load img url
        await element.scroll_into_view_if_needed()

        title = await element.locator(
            "//h6",
        ).text_content()
        if title is None:
            raise ValueError("Couldn't find title.")

        # For current offers, the date is included twice but both mean the enddate
        # Format: 2022-02-24T16:00:00.000Z
        valid_to = await element.locator(
            '//span[text()="Free Now - "]/time[1]',
        ).get_attribute("datetime")
        if valid_to is None:
            raise ValueError(f"Couldn't find valid to for {title}.")

        url = await element.get_attribute("href")
        if url is None:
            raise ValueError(f"Couldn't find url for {title}.")
        if not url.startswith("http"):
            url = BASE_URL + url

        img_url = await element.locator("img").get_attribute("src")
        if img_url is None:
            raise ValueError(f"Couldn't find image for {title}.")

        return EpicRawOffer(
            title=title,
            valid_to=valid_to,
            url=url,
            img_url=img_url,
        )

    def normalize_offer(self, raw_offer: RawOffer) -> Offer:
        if not isinstance(raw_offer, EpicRawOffer):
            raise TypeError("Wrong type of raw offer.")

        rawtext = {
            "title": raw_offer.title,
            "enddate": raw_offer.valid_to,
        }

        utc_valid_to = None
        if raw_offer.valid_to:
            try:
                utc_valid_to = datetime.strptime(
                    raw_offer.valid_to,
                    "%Y-%m-%dT%H:%M:%S.000Z",
                ).replace(tzinfo=UTC)
            except ValueError:
                # TODO: Error handling, put main loop into Scraper and handle
                # normalization here for each entry
                utc_valid_to = None

        return Offer(
            source=EpicGamesScraper.get_source(),
            duration=EpicGamesScraper.get_duration(),
            type=EpicGamesScraper.get_type(),
            title=raw_offer.title,
            probable_game_name=raw_offer.title,
            seen_last=datetime.now(UTC),
            valid_to=utc_valid_to,
            rawtext=rawtext,
            url=raw_offer.url,
            img_url=raw_offer.img_url,
        )

from __future__ import annotations

import logging
import urllib.parse
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING

import schedule

from lootscraper.browser import get_new_page
from lootscraper.common import OfferDuration, OfferType, Source
from lootscraper.database import Offer
from lootscraper.scraper.info_steam import skip_age_verification
from lootscraper.scraper.scraper_base import OfferHandler, RawOffer, Scraper
from lootscraper.utils import clean_combined_title, clean_game_title

if TYPE_CHECKING:
    from playwright.async_api import Locator, Page

logger = logging.getLogger(__name__)

BASE_URL = "https://store.steampowered.com"
SEARCH_URL = BASE_URL + "/search/"
DETAILS_URL = BASE_URL + "/app/"


@dataclass(kw_only=True)
class SteamRawOffer(RawOffer):
    appid: int
    text: str


class SteamBaseScraper(Scraper):
    @staticmethod
    def get_source() -> Source:
        return Source.STEAM

    @staticmethod
    def get_duration() -> OfferDuration:
        return OfferDuration.CLAIMABLE

    @staticmethod
    def get_schedule() -> list[schedule.Job]:
        return [schedule.every(30).minutes]

    def get_steam_category(self) -> int:
        raise NotImplementedError("Please implement this method")

    def get_offer_handlers(self, page: Page) -> list[OfferHandler]:
        return [
            OfferHandler(
                page.locator("#search_results a"),
                self.read_raw_offer,
                self.normalize_offer,
            ),
        ]

    def get_offers_url(self) -> str:
        params = {
            "maxprice": "free",
            "category1": self.get_steam_category(),  # Games or DLC
            "specials": 1,
        }

        return f"{SEARCH_URL}?{urllib.parse.urlencode(params)}"

    def get_page_ready_selector(self) -> str:
        return "#search_results"

    def get_validtext_locator(self, page: Page) -> Locator:
        raise NotImplementedError("Please implement this method")

    async def read_raw_offer(self, element: Locator) -> SteamRawOffer | None:
        title = await element.locator(".title").text_content()
        if title is None:
            raise ValueError("Couldn't find title.")

        appid = await element.get_attribute("data-ds-appid")
        if appid is None:
            raise ValueError(f"Couldn't find appid for {title}.")

        # new_price = await element.locator(".discount_final_price").text_content()

        # logger.info(f"Price seen: {new_price} for {title}")

        # if new_price and "€" in new_price and "0,00" not in new_price:
        #     logger.warning(f"Price is not free for {title}.")
        #     return None

        url = DETAILS_URL + str(appid)

        async with get_new_page(self.context) as page:
            await page.goto(url)

            await skip_age_verification(page)
            await page.wait_for_selector(".game_area_purchase")

            img_url = await page.locator(".game_header_image_full").get_attribute("src")
            if img_url is None:
                raise ValueError(f"Couldn't find image for {title}.")

            # Get the resolved text here because the text_content() contains
            # special characters.
            # Sometimes this does not exist, when a game is not free any more
            # or only some DLCs of the game are free.
            try:
                text = await page.locator(
                    ".game_purchase_discount_quantity",
                ).inner_text()
                if text is None:
                    logger.warning(
                        f"Offer for {title} seems to be broken, skipping it.",
                    )
            except Exception:
                logger.warning(
                    f"Offer for {title} doesn't contain any free items, skipping it.",
                )
                return None

        return SteamRawOffer(
            title=title,
            url=url,
            img_url=img_url,
            appid=int(appid),
            text=text,
        )

    def normalize_offer(self, raw_offer: RawOffer) -> Offer:
        if not isinstance(raw_offer, SteamRawOffer):
            raise TypeError("Wrong type of raw offer.")

        rawtext = {
            "title": raw_offer.title,
            "appid": raw_offer.appid,
            "text": raw_offer.text,
        }

        now = datetime.now(UTC)
        valid_to: datetime | None = None
        if raw_offer.text:
            maybe_date = raw_offer.text.removeprefix(
                "Free to keep when you get it before ",
            ).removesuffix(". Some limitations apply. (?)")
            try:
                valid_to = (
                    datetime.strptime(maybe_date, "%d %b @ %I:%M%p")
                    .replace(tzinfo=UTC)
                    .replace(year=now.year)
                )
                # Date has to be in the future, adjust the year accordingly
                yesterday = now - timedelta(days=1)
                if valid_to < yesterday:
                    valid_to = valid_to.replace(year=valid_to.year + 1)
            except ValueError:
                logger.warning(f"Couldn't parse date {maybe_date}.")

        probable_game_name = (
            clean_game_title(raw_offer.title)
            if self.get_type() == OfferType.GAME
            else clean_combined_title(raw_offer.title)[0]
        )

        return Offer(
            source=self.get_source(),
            duration=self.get_duration(),
            type=self.get_type(),
            title=raw_offer.title,
            probable_game_name=probable_game_name,
            seen_last=now,
            valid_to=valid_to,
            rawtext=rawtext,
            url=raw_offer.url,
        )

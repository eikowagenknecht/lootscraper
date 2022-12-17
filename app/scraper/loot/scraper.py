from __future__ import annotations

import logging
import re
from asyncio import sleep
from dataclasses import dataclass
from datetime import datetime
from typing import Awaitable, Callable

from playwright.async_api import BrowserContext, Error, Locator, Page

from app.common import Category, OfferDuration, OfferType, Source
from app.configparser import Config
from app.pagedriver import get_new_page
from app.sqlalchemy import Offer

logger = logging.getLogger(__name__)

SCROLL_PAUSE_SECONDS = 1  # Long enough so even slow JS can catch up


@dataclass(kw_only=True)
class RawOffer:
    title: str
    url: str | None = None
    img_url: str | None = None


@dataclass
class OfferHandler:
    locator: Locator
    read_offer_func: Callable[[Locator], Awaitable[RawOffer | None]]
    normalize_offer_func: Callable[[RawOffer], Offer]


class Scraper:
    def __init__(self, context: BrowserContext):
        self.context = context

    async def scrape(self) -> list[Offer]:
        offers = await self.read_offers()
        unique_offers = self.deduplicate_offers(offers)
        categorized_offers = self.categorize_offers(unique_offers)
        # TODO: Check what this does.
        # Originates from HumbleGamesScraper and GoogleGamesScraper
        filtered_offers = list(
            filter(lambda offer: offer.category != Category.DEMO, categorized_offers)
        )
        return filtered_offers

    @staticmethod
    def get_type() -> OfferType:
        raise NotImplementedError("Please implement this method")

    @staticmethod
    def get_source() -> Source:
        raise NotImplementedError("Please implement this method")

    @staticmethod
    def get_duration() -> OfferDuration:
        raise NotImplementedError("Please implement this method")

    def get_offers_url(self) -> str:
        raise NotImplementedError("Please implement this method")

    def get_page_ready_selector(self) -> str:
        raise NotImplementedError("Please implement this method")

    def get_offer_handlers(self, page: Page) -> list[OfferHandler]:
        raise NotImplementedError("Please implement this method")

    async def page_loaded_hook(self, page: Page) -> None:
        pass

    async def read_offers(self) -> list[Offer]:
        offers: list[Offer] = []

        async with get_new_page(self.context) as page:
            await page.goto(self.get_offers_url())

            try:
                await page.wait_for_selector(self.get_page_ready_selector())
                await self.page_loaded_hook(page)
            except Error as e:
                # Without offers we can't do anything
                logger.error(f"The page didn't get ready to be parsed: {e}")
                filename = (
                    Config.data_path()
                    / f'error_{datetime.now().isoformat().replace(".", "_").replace(":", "_")}.png'
                )
                await page.screenshot(path=str(filename.resolve()))
                return []

            for handler in self.get_offer_handlers(page):
                offers_locator = handler.locator

                try:
                    no_res = await offers_locator.count()
                except Error as e:
                    # Without offers we can't do anything
                    logger.error(f"Couldn't find any offers: {e}")
                    return []

                for i in range(no_res):
                    try:
                        element = offers_locator.nth(i)
                        raw_offer = await handler.read_offer_func(element)
                        if raw_offer is None:
                            continue
                    except (ValueError, Error) as e:
                        # Skip offers that can't be loaded
                        logger.error(f"Couldn't parse offer {i}: {e}")
                        continue

                    normalized_offer = handler.normalize_offer_func(raw_offer)
                    offers.append(normalized_offer)

        return offers

    def categorize_offers(self, offers: list[Offer]) -> list[Offer]:
        """
        Categorize offers by title (demo, etc.)
        """
        for offer in offers:
            if Scraper.is_demo(offer.title):
                offer.category = Category.DEMO
                continue

        return offers

    def deduplicate_offers(self, offers: list[Offer]) -> list[Offer]:
        """
        Remove duplicate offers by title.
        """
        titles = set()
        new_offers = []

        for offer in offers:
            if offer.title not in titles:
                titles.add(offer.title)
                new_offers.append(offer)
            else:
                logger.debug(f"Duplicate offer: {offer.title}")

        return new_offers

    @staticmethod
    def is_demo(title: str) -> bool:
        if re.search(r"\Wdemo\W?$", title[-6:], re.IGNORECASE):
            return True
        if re.search(r"^\W?demo\W", title[:6], re.IGNORECASE):
            return True
        return False

    @staticmethod
    async def scroll_element_to_bottom(page: Page, element_id: str) -> None:
        """
        Scroll down to the bottom of the given alement.
        Useful for pages with infinite scrolling.
        """

        selector = f'document.getElementById("{element_id}")'

        # Get scroll height
        position = await page.evaluate(f"{selector}.scrollTop")
        scroll_amount = int(await page.evaluate(f"{selector}.clientHeight") * 0.8)

        scolled_x_times = 0

        while True:
            # Scroll down to bottom
            await page.evaluate(f"{selector}.scrollTo(0, {position + scroll_amount});")

            # Calculate new scroll height and compare with last scroll height
            new_position = await page.evaluate(f"{selector}.scrollTop")
            if new_position == position:
                break
            position = new_position

            # Do not scroll more than 100 times, something is wrong here!
            if scolled_x_times > 100:
                break

            # Wait to load page
            await sleep(SCROLL_PAUSE_SECONDS)

        # One final wait so the content may load
        await sleep(SCROLL_PAUSE_SECONDS)

    @staticmethod
    async def scroll_page_to_bottom(page: Page) -> None:
        """
        Scroll down to the bottom of the current page.
        Useful for pages with infinite scrolling.
        """

        # Get scroll height
        height = await page.evaluate("document.body.scrollHeight")

        scolled_x_times = 0

        while True:
            # Wait to load page. We do this first to give the page time for the initial load
            await sleep(SCROLL_PAUSE_SECONDS)

            # Scroll down to bottom
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight);")

            # Calculate new scroll height and compare with last scroll height
            new_height = await page.evaluate("document.body.scrollHeight")
            if new_height == height:
                break
            height = new_height

            # Do not scroll more than 100 times, something is wrong here!
            if scolled_x_times > 100:
                break

        # One final wait so the content may load
        await sleep(SCROLL_PAUSE_SECONDS)

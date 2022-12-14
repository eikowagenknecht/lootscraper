from __future__ import annotations

import logging
import re
from asyncio import sleep
from dataclasses import dataclass

from playwright.async_api import BrowserContext, Page

from app.common import Category, OfferDuration, OfferType, Source
from app.sqlalchemy import Offer

logger = logging.getLogger(__name__)

SCROLL_PAUSE_SECONDS = 1  # Long enough so even Amazons JS can catch up


@dataclass
class RawOffer:
    title: str | None
    url: str | None = None
    img_url: str | None = None


class Scraper(object):
    def __init__(self, context: BrowserContext):
        self.context = context

    async def scrape(self) -> list[Offer]:
        offers = await self.read_offers_from_page()
        return self.categorize_offers(offers)

    @staticmethod
    def get_type() -> OfferType:
        raise NotImplementedError("Please implement this method")

    @staticmethod
    def get_source() -> Source:
        raise NotImplementedError("Please implement this method")

    @staticmethod
    def get_duration() -> OfferDuration:
        raise NotImplementedError("Please implement this method")

    async def read_offers_from_page(self) -> list[Offer]:
        raise NotImplementedError("Please implement this method")

    def categorize_offers(self, offers: list[Offer]) -> list[Offer]:
        for offer in offers:

            if Scraper.is_demo(offer.title):
                offer.category = Category.DEMO
                continue

        return offers

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
        height = await page.evaluate("return document.body.scrollHeight")

        scolled_x_times = 0

        while True:
            # Wait to load page. We do this first to give the page time for the initial load
            await sleep(SCROLL_PAUSE_SECONDS)

            # Scroll down to bottom
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight);")

            # Calculate new scroll height and compare with last scroll height
            new_height = await page.evaluate("return document.body.scrollHeight")
            if new_height == height:
                break
            height = new_height

            # Do not scroll more than 100 times, something is wrong here!
            if scolled_x_times > 100:
                break

        # One final wait so the content may load
        await sleep(SCROLL_PAUSE_SECONDS)

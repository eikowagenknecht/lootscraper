from __future__ import annotations

import logging
import re
from asyncio import sleep
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Awaitable, Callable

from playwright.async_api import BrowserContext, Error, Locator, Page

from lootscraper.browser import get_new_page
from lootscraper.common import Category, OfferDuration, OfferType, Source
from lootscraper.config import Config
from lootscraper.database import Offer

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
        logging.info(
            f"Analyzing {self.get_source().value} for offers: {self.get_type().value} / {self.get_duration().value}."
        )
        offers = await self.read_offers()
        unique_offers = self.deduplicate_offers(offers)
        categorized_offers = self.categorize_offers(unique_offers)
        filtered_offers = self.clean_offers(categorized_offers)

        titles = ", ".join([offer.title for offer in filtered_offers])
        if len(filtered_offers) > 0:
            logger.info(f"Found {len(filtered_offers)} offers: {titles}.")
        elif self.offers_expected():
            logger.error("Found no offers, even though there hould be at least one.")
        else:
            logger.info("No offers found.")
        return filtered_offers

    @staticmethod
    def get_type() -> OfferType:
        """
        Returns the type of the offers this scraper is looking for.
        """
        raise NotImplementedError("Please implement this method")

    @staticmethod
    def get_source() -> Source:
        """
        Returns the source of the offers this scraper is looking for.
        """
        raise NotImplementedError("Please implement this method")

    @staticmethod
    def get_duration() -> OfferDuration:
        """
        Returns the duration of the offers this scraper is looking for.
        """
        raise NotImplementedError("Please implement this method")

    def offers_expected(self) -> bool:
        """
        Returns whether offers are always expected to be found on the page.
        """
        return False

    def get_offers_url(self) -> str:
        """
        Returns the URL of the page where the offers are listed.
        """
        raise NotImplementedError("Please implement this method")

    def get_page_ready_selector(self) -> str:
        """
        Returns the CSS selector of an element that is present when the page is
        ready to be parsed.
        """
        raise NotImplementedError("Please implement this method")

    def get_offer_handlers(self, page: Page) -> list[OfferHandler]:
        """
        Returns a list of OfferHandlers that can be used to read and normalize
        offers from the page.
        """
        raise NotImplementedError("Please implement this method")

    async def page_loaded_hook(self, page: Page) -> None:
        """
        This method is called after the page is loaded. Override for custom
        behavior that is needed here (e.g. scroll to bottom of page).
        """

    async def read_offers(self) -> list[Offer]:
        """
        Read all offers from the page. This method calls the custom handlers
        defined in get_offer_handlers() to read and normalize the offers.
        """
        offers: list[Offer] = []

        async with get_new_page(self.context) as page:
            try:
                await page.goto(self.get_offers_url(), timeout=30000)
            except Error as e:
                logger.error(f"Couldn't load page: {e}")
                return []

            try:
                await page.wait_for_selector(
                    self.get_page_ready_selector(), timeout=10000
                )
                await self.page_loaded_hook(page)
            except Error as e:
                logger.error(f"The page didn't get ready to be parsed: {e}")
                filename = (
                    Config.data_path()
                    / f'error_{self.get_source().name.lower()}_{datetime.now().isoformat().replace(".", "_").replace(":", "_")}.png'
                )
                logger.error(f"Saving screenshot to {filename}.")
                await page.screenshot(path=str(filename.resolve()))
                return []

            for handler in self.get_offer_handlers(page):
                offers_locator = handler.locator

                try:
                    elements = await offers_locator.all()
                except Error as e:
                    # Without offers we can't do anything
                    logger.error(f"Couldn't find any offers: {e}")
                    return []

                for element in elements:
                    try:
                        raw_offer = await handler.read_offer_func(element)
                        if raw_offer is None:
                            continue
                    except Exception as e:  # pylint: disable=broad-except
                        # Skip offers that can't be loaded
                        logger.error(f"Couldn't parse element {str(element)}: {e}")
                        continue

                    try:
                        normalized_offer = handler.normalize_offer_func(raw_offer)
                    except Exception as e:  # pylint: disable=broad-except
                        logger.error(f"Couldn't normalize offer {raw_offer.title}: {e}")
                        continue

                    offers.append(normalized_offer)

        return offers

    def categorize_offers(self, offers: list[Offer]) -> list[Offer]:
        """
        Categorize offers by title (demo, etc.)
        """
        for offer in offers:
            if self.is_demo(offer.title):
                offer.category = Category.DEMO
                continue
            if self.is_prerelease(offer.title):
                offer.category = Category.PRERELEASE
                continue
            if self.is_fake_always(offer.valid_to):
                offer.duration = OfferDuration.ALWAYS
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

    def clean_offers(self, offers: list[Offer]) -> list[Offer]:
        """
        Only keep valid offers.
        """
        return list(
            filter(
                lambda offer: offer.category == Category.VALID
                or offer.category is None,
                offers,
            )
        )

    @staticmethod
    def is_demo(title: str) -> bool:
        """
        Check if the given title is a demo.
        """

        # Check for demo in title
        # Catches titles like
        # - "Demo: Title"
        # - "Title (Demo)"
        # - "Title Demo"
        # - "Title Demo (Version)",
        # - "Title Demo (Great game)",
        # - "Title Demo Version"
        if re.search(
            r"^[\W]?demo[\W]|\Wdemo\W?((.*version.*)|(\(.*\)))?$",
            title,
            re.IGNORECASE,
        ):
            return True
        if re.search(
            r"^[\W]?teaser[\W]|\Wteaser\W?((.*version.*)|(\(.*\)))?$",
            title,
            re.IGNORECASE,
        ):
            return True
        return False

    @staticmethod
    def is_prerelease(title: str) -> bool:
        """
        Check if the given title is an alpha or beta version.
        """

        # Check for demo in title
        # Catches titles like
        # - "Alpha: Title"
        # - "Title (Alpha)"
        # - "Title Alpha"
        # - "Title Alpha (Version)",
        # - "Title Alpha (Great game)",
        # - "Title Alpha Version"
        if re.search(
            r"^[\W]?alpha[\W]|\Walpha\W?((.*version.*)|(\(.*\)))?$",
            title,
            re.IGNORECASE,
        ):
            return True
        if re.search(
            r"^[\W]?beta[\W]|\Wbeta\W?((.*version.*)|(\(.*\)))?$",
            title,
            re.IGNORECASE,
        ):
            return True
        return False

    @staticmethod
    def is_fake_always(valid_to: datetime | None) -> bool:
        """
        Check if the offer is "always" valid. That means the end date is
        unreasonably far in the future (100 days or more).
        """

        if valid_to is None:
            return False

        return valid_to > datetime.now().replace(tzinfo=timezone.utc) + timedelta(
            days=100
        )

    @staticmethod
    async def scroll_element_to_bottom(page: Page, element_id: str) -> None:
        """
        Scroll down to the bottom of the given element.
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

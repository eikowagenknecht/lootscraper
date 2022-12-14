import logging
from asyncio import sleep
from datetime import datetime, timezone

from playwright.async_api import Error, Locator

from app.common import OfferDuration, OfferType, Source
from app.pagedriver import get_new_page
from app.scraper.loot.scraper import RawOffer, Scraper
from app.sqlalchemy import Offer

logger = logging.getLogger(__name__)

ROOT_URL = "https://www.gog.com/partner/free_games"

# XPATH_PAGE_LOADED = """//div[@class="content cf"]"""

# XPATH_SWITCH_TO_ENGLISH = """//li[contains(concat(" ", normalize-space(@class), " "), " footer-microservice-language__item ")][1]"""
# XPATH_SELECTED_LANGUAGE = """//li[contains(concat(" ", normalize-space(@class), " "), " footer-microservice-language__item is-selected ")]"""

# Variant 1
# XPATH_GAMES = """//ul[contains(concat(" ", normalize-space(@class), " "), " partners__game-list ")]"""
# SUBPATH_OFFERS = """.//a"""  # URL: Attribute href
# SUBPATH_TITLE = """.//span[contains(concat(" ", normalize-space(@class), " "), " product-title__text ")]"""
# SUBPATH_IMAGE = """.//img"""  # Attribute srcset, first entry


class GogGamesAlwaysFreeScraper(Scraper):
    @staticmethod
    def get_source() -> Source:
        return Source.GOG

    @staticmethod
    def get_type() -> OfferType:
        return OfferType.GAME

    @staticmethod
    def get_duration() -> OfferDuration:
        return OfferDuration.ALWAYS

    async def read_offers_from_page(self) -> list[Offer]:
        raw_offers: list[RawOffer] = []

        async with get_new_page(self.context) as page:
            await page.goto(ROOT_URL)
            try:
                await page.wait_for_selector(".content.cf")
            except Error as e:
                logger.error(f"Page could not be read: {e}")
                return []

            try:
                # Switch to english version
                en = page.locator("li.footer-microservice-language__item").first
                await en.click()
                await sleep(2)  # Wait for the language switching to begin
                # Check if it's really english now
                current_language = await page.locator(
                    "li.footer-microservice-language__item.is-selected"
                ).text_content()
                if current_language != "English":
                    logger.error(
                        f"Tried switching to English, but {current_language} is active instead."
                    )
                    return []
            except Error as e:
                logger.error(f"Couldn't switch to English: {e}")
                return []

            try:
                await page.wait_for_selector(".partners__game-list")
            except Error as e:
                logger.info(f"Giveaways couldn't load, probably there are none: {e}")

            elements = page.locator(".partners__game-list a")

            try:
                no_res = await elements.count()

                for i in range(no_res):
                    element = elements.nth(i)
                    try:
                        raw_offer = await GogGamesAlwaysFreeScraper.read_raw_offer(
                            element
                        )
                        raw_offers.append(raw_offer)
                    except Error as e:
                        logger.error(f"Error loading offer: {e}")
            except Error as e:
                logger.error(f"Error loading offers: {e}")

        normalized_offers = GogGamesAlwaysFreeScraper.normalize_offers(raw_offers)

        return normalized_offers

    @staticmethod
    async def read_raw_offer(element: Locator) -> RawOffer:
        title_str = await element.locator(".product-title__text").text_content()
        url_str = await element.get_attribute("href")
        img_url_str = await element.locator("img").get_attribute("srcset")
        if img_url_str is not None:
            img_url_str = "https:" + (
                img_url_str.split(",", maxsplit=1)[0]
                .strip()
                .removesuffix(" 2x")
                .removesuffix(" 1x")
            )

        return RawOffer(
            title=title_str,
            url=url_str,
            img_url=img_url_str,
        )

    @staticmethod
    def normalize_offers(raw_offers: list[RawOffer]) -> list[Offer]:
        normalized_offers: list[Offer] = []

        for raw_offer in raw_offers:
            # Raw text
            if not raw_offer.title:
                logger.error(f"Error with offer, has no title: {raw_offer}")
                continue

            rawtext = f"<title>{raw_offer.title}</title>"

            # Title
            # Contains additional text that needs to be stripped
            title = raw_offer.title

            # Valid to
            nearest_url = raw_offer.url if raw_offer.url else ROOT_URL
            offer = Offer(
                source=GogGamesAlwaysFreeScraper.get_source(),
                duration=GogGamesAlwaysFreeScraper.get_duration(),
                type=GogGamesAlwaysFreeScraper.get_type(),
                title=title,
                probable_game_name=title,
                seen_last=datetime.now(timezone.utc),
                rawtext=rawtext,
                url=nearest_url,
                img_url=raw_offer.img_url,
            )

            normalized_offers.append(offer)
        return normalized_offers

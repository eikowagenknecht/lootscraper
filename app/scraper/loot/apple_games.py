import logging
import urllib.parse
from datetime import datetime, timezone

from playwright.async_api import Error, Locator

from app.common import OfferDuration, OfferType, Source
from app.pagedriver import get_new_page
from app.scraper.loot.scraper import RawOffer, Scraper
from app.sqlalchemy import Offer

logger = logging.getLogger(__name__)

ROOT_URL = "https://appsliced.co/apps/iphone"


class AppleGamesScraper(Scraper):
    @staticmethod
    def get_source() -> Source:
        return Source.APPLE

    @staticmethod
    def get_type() -> OfferType:
        return OfferType.GAME

    @staticmethod
    def get_duration() -> OfferDuration:
        return OfferDuration.CLAIMABLE

    async def read_offers_from_page(self) -> list[Offer]:
        params = {
            "sort": "latest",
            "price": "free",
            "cat[]": 6014,
            "page": 1,
        }
        url = f"{ROOT_URL}?{urllib.parse.urlencode(params)}"
        raw_offers: list[RawOffer] = []

        async with get_new_page(self.context) as page:
            await page.goto(url)

            try:
                await page.wait_for_selector("article.app")
            except Error as e:
                logger.error(
                    f"Error loading search result page. Maybe we are blocked: {e}"
                )

            elements = page.locator("article.app")
            try:
                no_res = await elements.count()

                for i in range(no_res):
                    element = elements.nth(i)
                    try:
                        raw_offer = await AppleGamesScraper.read_raw_offer(element)
                        raw_offers.append(raw_offer)
                    except Error as e:
                        logger.error(f"Error loading offer: {e}")
            except Error as e:
                logger.error(f"Error loading offers: {e}")

        normalized_offers = AppleGamesScraper.normalize_offers(raw_offers)
        categorized_offers = self.categorize_offers(normalized_offers)

        return categorized_offers

    @staticmethod
    async def read_raw_offer(element: Locator) -> RawOffer:
        title = await element.locator(".title a").get_attribute("title")
        url = await element.locator(".title a").get_attribute("href")
        img_url = await element.locator(".icon img").get_attribute("src")

        return RawOffer(
            title=title,
            url=url,
            img_url=img_url,
        )

    @staticmethod
    def normalize_offers(raw_offers: list[RawOffer]) -> list[Offer]:
        normalized_offers: list[Offer] = []

        for raw_offer in raw_offers:
            # Raw text
            rawtext = f"<title>{raw_offer.title}</title>"

            # Title
            title = raw_offer.title

            nearest_url = raw_offer.url if raw_offer.url else ROOT_URL
            offer = Offer(
                source=AppleGamesScraper.get_source(),
                duration=AppleGamesScraper.get_duration(),
                type=AppleGamesScraper.get_type(),
                title=title,
                probable_game_name=title,
                seen_last=datetime.now(timezone.utc),
                rawtext=rawtext,
                url=nearest_url,
                img_url=raw_offer.img_url,
            )

            if title is not None and len(title) > 0:
                normalized_offers.append(offer)

        return normalized_offers

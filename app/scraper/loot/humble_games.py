import logging
import urllib.parse
from dataclasses import dataclass
from datetime import datetime, timezone

from playwright.async_api import Error, Locator

from app.common import Category, OfferDuration, OfferType, Source
from app.pagedriver import get_new_page
from app.scraper.loot.scraper import RawOffer, Scraper
from app.sqlalchemy import Offer

logger = logging.getLogger(__name__)

BASE_URL = "https://humblebundle.com"
SEARCH_URL = BASE_URL + "/store/search"


@dataclass
class HumbleRawOffer(RawOffer):
    valid_to: str | None = None


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

    async def scrape(self) -> list[Offer]:
        offers = await self.read_offers_from_page()
        categorized_offers = self.categorize_offers(offers)
        filtered = list(
            filter(lambda offer: offer.category != Category.DEMO, categorized_offers)
        )
        return filtered

    async def read_offers_from_page(self) -> list[Offer]:
        raw_offers: list[HumbleRawOffer] = []

        params = {
            "sort": "discount",
            "filter": "onsale",
        }
        url = f"{SEARCH_URL}?{urllib.parse.urlencode(params)}"

        async with get_new_page(self.context) as page:
            await page.goto(url)

            # XPATH_FREE_RESULTS = """//li[.//div[contains(concat(" ", normalize-space(@class), " "), " discount-amount ") and contains(text(), "100")]]//a"""  # URL: Attribute href
            elements = page.locator(
                "li", has=page.locator("div.discount-amount", has_text="100")
            )

            try:
                await page.wait_for_selector("li div.discount-amount")
                no_res = await elements.count()

                for i in range(no_res):
                    element = elements.nth(i)
                    raw_offers.append(await HumbleGamesScraper.read_raw_offer(element))
            except Error as e:
                logger.info(f"Could not find any results: {e}")

        normalized_offers = HumbleGamesScraper.normalize_offers(raw_offers)

        return normalized_offers

    @staticmethod
    async def read_raw_offer(element: Locator) -> HumbleRawOffer:
        title_str = await element.locator("span.entity-title").text_content()
        url_str = await element.locator("a").get_attribute("href")
        if url_str is not None:
            url_str = BASE_URL + url_str
        img_url_str = await element.locator("img.entity-image").get_attribute("src")

        # TODO: Check details page for valid_to (makes it easier to filter out nonsense entries that are valid "forever")
        return HumbleRawOffer(
            title=title_str,
            url=url_str,
            img_url=img_url_str,
        )

    @staticmethod
    def normalize_offers(raw_offers: list[HumbleRawOffer]) -> list[Offer]:
        normalized_offers: list[Offer] = []

        for raw_offer in raw_offers:
            # Raw text
            if not raw_offer.title:
                logger.error(f"Error with offer, has no title: {raw_offer}")
                continue

            rawtext = f"<title>{raw_offer.title}</title>"

            # Title
            title = raw_offer.title

            nearest_url = raw_offer.url if raw_offer.url else SEARCH_URL
            offer = Offer(
                source=HumbleGamesScraper.get_source(),
                duration=HumbleGamesScraper.get_duration(),
                type=HumbleGamesScraper.get_type(),
                title=title,
                probable_game_name=title,
                seen_last=datetime.now(timezone.utc),
                rawtext=rawtext,
                url=nearest_url,
                img_url=raw_offer.img_url,
            )

            normalized_offers.append(offer)

        return normalized_offers

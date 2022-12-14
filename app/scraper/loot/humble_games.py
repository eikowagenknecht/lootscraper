import logging
from dataclasses import dataclass
from datetime import datetime, timezone

from selenium.common.exceptions import WebDriverException
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from app.common import Category, OfferDuration, OfferType, Source
from app.scraper.loot.scraper import RawOffer, Scraper
from app.sqlalchemy import Offer

logger = logging.getLogger(__name__)

ROOT_URL = "https://de.humblebundle.com/store/search?sort=discount&filter=onsale"

XPATH_SEARCH_RESULTS = (
    """//ul[contains(concat(" ", normalize-space(@class), " "), " entities-list ")]"""
)
XPATH_FREE_RESULTS = """//ul[contains(concat(" ", normalize-space(@class), " "), " entities-list ")]/li[.//div[contains(concat(" ", normalize-space(@class), " "), " discount-amount ") and contains(text(), "100")]]//a"""  # URL: Attribute href
SUBPATH_TITLE = """.//span[contains(concat(" ", normalize-space(@class), " "), " entity-title ")]"""  # /text()
SUBPATH_IMAGE = """.//img"""  # Attr "src"


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
        self.context.get(ROOT_URL)
        raw_offers: list[HumbleRawOffer] = []

        try:
            # Wait until the page loaded
            WebDriverWait(self.context, Scraper.get_max_wait_seconds()).until(
                EC.presence_of_element_located((By.XPATH, XPATH_FREE_RESULTS))
            )

            offer_elements = self.context.find_elements(By.XPATH, XPATH_FREE_RESULTS)
            for offer_element in offer_elements:
                raw_offers.append(HumbleGamesScraper.read_raw_offer(offer_element))

        except WebDriverException:
            logger.info(
                f"Free search results took longer than {Scraper.get_max_wait_seconds()} to load, probably there are none"
            )

        normalized_offers = HumbleGamesScraper.normalize_offers(raw_offers)

        return normalized_offers

    @staticmethod
    def read_raw_offer(element: WebElement) -> HumbleRawOffer:
        title_str = None
        url_str = None
        img_url_str = None

        try:
            # We use .get_attribute("textContent") instead of .text here,
            # because .text applies uppercase CSS formatting
            title_str = str(
                element.find_element(By.XPATH, SUBPATH_TITLE).get_attribute(
                    "textContent"
                )
            )
        except WebDriverException:
            # Nothing to do here, string stays empty
            pass

        try:
            url_str = str(element.get_attribute("href"))  # type: ignore
        except WebDriverException:
            # Nothing to do here, string stays empty
            pass

        try:
            img_url_str = str(
                element.find_element(By.XPATH, SUBPATH_IMAGE).get_attribute("src")
            )
        except WebDriverException:
            # Nothing to do here, string stays empty
            pass

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

            nearest_url = raw_offer.url if raw_offer.url else ROOT_URL
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

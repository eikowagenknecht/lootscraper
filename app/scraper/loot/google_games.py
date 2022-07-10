import logging
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

ROOT_URL = "https://appagg.com/sale/android-games/free/?hl=en"

XPATH_SEARCH_RESULTS = (
    """//li//div[contains(concat(" ", normalize-space(@class), " "), " short_info ")]"""
)
SUBPATH_TITLE = """.//a"""  # /text()
SUBPATH_IMAGE = """.//span[contains(concat(" ", normalize-space(@class), " "), " pic_div ")]"""  # Attr "style"


class GoogleGamesScraper(Scraper):
    @staticmethod
    def get_source() -> Source:
        return Source.GOOGLE

    @staticmethod
    def get_type() -> OfferType:
        return OfferType.GAME

    @staticmethod
    def get_duration() -> OfferDuration:
        return OfferDuration.CLAIMABLE

    def scrape(self) -> list[Offer]:
        offers = self.read_offers_from_page()
        categorized_offers = self.categorize_offers(offers)
        filtered = list(
            filter(lambda offer: offer.category != Category.DEMO, categorized_offers)
        )
        return filtered

    def read_offers_from_page(self) -> list[Offer]:
        self.driver.get(ROOT_URL)
        raw_offers: list[RawOffer] = []

        try:
            # Wait until the page loaded
            WebDriverWait(self.driver, Scraper.get_max_wait_seconds()).until(
                EC.presence_of_element_located((By.XPATH, XPATH_SEARCH_RESULTS))
            )

            offer_elements = self.driver.find_elements(By.XPATH, XPATH_SEARCH_RESULTS)
            for offer_element in offer_elements:
                raw_offers.append(GoogleGamesScraper.read_raw_offer(offer_element))

        except WebDriverException:
            logger.info(
                f"Free search results took longer than {Scraper.get_max_wait_seconds()} to load, probably there are none"
            )

        normalized_offers = GoogleGamesScraper.normalize_offers(raw_offers)

        return normalized_offers

    @staticmethod
    def read_raw_offer(element: WebElement) -> RawOffer:
        title_str = None
        url_str = None
        img_url_str = None

        try:
            title_str = str(
                element.find_element(By.XPATH, SUBPATH_TITLE).get_attribute("title")
            )
        except WebDriverException:
            # Nothing to do here, string stays empty
            pass

        try:
            url_str = str(element.find_element(By.XPATH, SUBPATH_TITLE).get_attribute("href"))  # type: ignore
        except WebDriverException:
            # Nothing to do here, string stays empty
            pass

        try:
            img_url_str = str(
                element.find_element(By.XPATH, SUBPATH_IMAGE).get_attribute("style")
            )
            img_url_str = img_url_str.removeprefix(
                'background-image: url("'
            ).removesuffix('");')
        except WebDriverException:
            # Nothing to do here, string stays empty
            pass

        return RawOffer(
            title=title_str,
            url=url_str,
            img_url=img_url_str,
        )

    @staticmethod
    def normalize_offers(raw_offers: list[RawOffer]) -> list[Offer]:
        normalized_offers: list[Offer] = []

        for raw_offer in raw_offers:
            # Skip not recognized offers
            if not raw_offer.title:
                logger.error(f"Offer not recognized, skipping: {raw_offer}")
                continue

            # Raw text
            rawtext = ""
            if raw_offer.title:
                rawtext += f"<title>{raw_offer.title}</title>"

            # Title
            title = raw_offer.title

            nearest_url = raw_offer.url if raw_offer.url else ROOT_URL
            offer = Offer(
                source=GoogleGamesScraper.get_source(),
                duration=GoogleGamesScraper.get_duration(),
                type=GoogleGamesScraper.get_type(),
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

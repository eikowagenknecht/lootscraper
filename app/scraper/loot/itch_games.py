import logging
from datetime import datetime, timezone

from selenium.common.exceptions import WebDriverException
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from app.common import OfferDuration, OfferType, Source
from app.scraper.loot.scraper import RawOffer, Scraper
from app.sqlalchemy import Offer

logger = logging.getLogger(__name__)

ROOT_URL = "https://itch.io/games/new-and-popular/on-sale"

# XPATH_SEARCH_RESULTS = """//div[contains(concat(" ", normalize-space(@class), " "), " game_grid_widget ")]"""
XPATH_FREE_RESULTS = """//div[contains(concat(" ", normalize-space(@class), " "), " game_grid_widget ")]//div[contains(concat(" ", normalize-space(@class), " "), " game_cell ") and .//div[@class="sale_tag" and contains(text(), "100")]]"""  # URL: Attribute href
SUBPATH_TITLE = """.//a[contains(concat(" ", normalize-space(@class), " "), " title ")]"""  # /text(), URL: Attribute href
SUBPATH_IMAGE = """.//img"""  # Attribute src


class ItchGamesScraper(Scraper):
    @staticmethod
    def get_source() -> Source:
        return Source.ITCH

    @staticmethod
    def get_type() -> OfferType:
        return OfferType.GAME

    @staticmethod
    def get_duration() -> OfferDuration:
        return OfferDuration.CLAIMABLE

    async def read_offers_from_page(self) -> list[Offer]:
        self.context.get(ROOT_URL)

        raw_offers: list[RawOffer] = []

        try:
            # Wait until the page loaded
            WebDriverWait(self.context, Scraper.get_max_wait_seconds()).until(
                EC.presence_of_element_located((By.XPATH, XPATH_FREE_RESULTS))
            )

            await ItchGamesScraper.scroll_page_to_bottom(self.context)

            offer_elements = self.context.find_elements(By.XPATH, XPATH_FREE_RESULTS)
            for offer_element in offer_elements:
                raw_offers.append(ItchGamesScraper.read_raw_offer(offer_element))
        except WebDriverException:
            logger.error(
                f"Page took longer than {Scraper.get_max_wait_seconds()} to load"
            )
            return []

        normalized_offers = ItchGamesScraper.normalize_offers(raw_offers)

        return normalized_offers

    @staticmethod
    def read_raw_offer(element: WebElement) -> RawOffer:
        title_str = None
        url_str = None
        img_url_str = None

        try:
            title_str = str(element.find_element(By.XPATH, SUBPATH_TITLE).text)
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
                element.find_element(By.XPATH, SUBPATH_IMAGE).get_attribute("src")
            )
        except WebDriverException:
            # Nothing to do here, string stays empty
            pass

        # For current offers, the date is included twice but only means the enddate

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
                source=ItchGamesScraper.get_source(),
                duration=ItchGamesScraper.get_duration(),
                type=ItchGamesScraper.get_type(),
                title=title,
                probable_game_name=title,
                seen_last=datetime.now(timezone.utc),
                rawtext=rawtext,
                url=nearest_url,
                img_url=raw_offer.img_url,
            )

            normalized_offers.append(offer)

        return normalized_offers

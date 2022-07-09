import logging
from datetime import datetime, timezone
from time import sleep

from selenium.common.exceptions import WebDriverException
from selenium.webdriver.chrome.webdriver import WebDriver
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from app.common import OfferDuration, OfferType, Source
from app.scraper.loot.scraper import RawOffer, Scraper
from app.sqlalchemy import Offer

logger = logging.getLogger(__name__)

ROOT_URL = "https://www.gog.com/partner/free_games"

XPATH_PAGE_LOADED = """//div[@class="content cf"]"""

XPATH_SWITCH_TO_ENGLISH = """//li[contains(concat(" ", normalize-space(@class), " "), " footer-microservice-language__item ")][1]"""
XPATH_SELECTED_LANGUAGE = """//li[contains(concat(" ", normalize-space(@class), " "), " footer-microservice-language__item is-selected ")]"""

# Variant 1
XPATH_GAMES = """//ul[contains(concat(" ", normalize-space(@class), " "), " partners__game-list ")]"""
SUBPATH_OFFERS = """.//a"""  # URL: Attribute href
SUBPATH_TITLE = """.//span[contains(concat(" ", normalize-space(@class), " "), " product-title__text ")]"""
SUBPATH_IMAGE = """.//img"""  # Attribute srcset, first entry


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

    @staticmethod
    def scrape(driver: WebDriver) -> list[Offer]:
        return GogGamesAlwaysFreeScraper.read_offers_from_page(driver)

    @staticmethod
    def read_offers_from_page(driver: WebDriver) -> list[Offer]:
        driver.get(ROOT_URL)
        try:
            # Wait until the page loaded
            WebDriverWait(driver, Scraper.get_max_wait_seconds()).until(
                EC.presence_of_element_located((By.XPATH, XPATH_PAGE_LOADED))
            )
        except WebDriverException:
            logger.error(
                f"Page took longer than {Scraper.get_max_wait_seconds()} to load"
            )
            return []

        try:
            # Switch to english version
            en = driver.find_element(By.XPATH, XPATH_SWITCH_TO_ENGLISH)
            en.click()
            sleep(2)  # Wait for the language switching to begin
            # Check if it's really english now
            en_test = driver.find_element(By.XPATH, XPATH_SELECTED_LANGUAGE)
            if en_test.text != "English":
                logger.error(
                    f"Tried switching to English, but {en_test.text} is active instead"
                )
                return []
        except WebDriverException:
            logger.error("Couldn't switch to English")
            return []

        raw_offers: list[RawOffer] = []

        try:
            # Wait until the page loaded
            WebDriverWait(driver, Scraper.get_max_wait_seconds()).until(
                EC.presence_of_element_located((By.XPATH, XPATH_GAMES))
            )

            offer_elements = driver.find_elements(By.XPATH, SUBPATH_OFFERS)
            for offer_element in offer_elements:
                raw_offers.append(
                    GogGamesAlwaysFreeScraper.read_raw_offer(offer_element)
                )
        except WebDriverException:
            logger.info(
                f"Giveaways took longer than {Scraper.get_max_wait_seconds()} to load, probably there are none"
            )

        normalized_offers = GogGamesAlwaysFreeScraper.normalize_offers(raw_offers)

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
            url_str = str(element.get_attribute("href"))  # type: ignore
        except WebDriverException:
            # Nothing to do here, string stays empty
            pass

        try:
            img_url_str = str(
                element.find_element(By.XPATH, SUBPATH_IMAGE).get_attribute("srcset")
            )
            img_url_str = "https:" + (
                img_url_str.split(",")[0]
                .strip()
                .removesuffix(" 2x")
                .removesuffix(" 1x")
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
            rawtext = ""
            if raw_offer.title:
                rawtext += f"<title>{raw_offer.title}</title>"

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

            if title is not None and len(title) > 0:
                normalized_offers.append(offer)
        return normalized_offers

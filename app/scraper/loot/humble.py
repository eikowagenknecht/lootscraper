import logging
from dataclasses import dataclass
from datetime import datetime, timezone

from selenium.common.exceptions import WebDriverException
from selenium.webdriver.chrome.webdriver import WebDriver
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from app.common import OfferDuration, OfferType, Source
from app.scraper.loot.scraper import Scraper
from app.sqlalchemy import Offer

logger = logging.getLogger(__name__)

SCRAPER_NAME = "Humble Bundle"
ROOT_URL = "https://de.humblebundle.com/store/search?sort=discount&filter=onsale"
MAX_WAIT_SECONDS = 15  # Needs to be quite high in Docker for first run

XPATH_SEARCH_RESULTS = (
    """//ul[contains(concat(" ", normalize-space(@class), " "), " entities-list ")]"""
)
XPATH_FREE_RESULTS = """//ul[contains(concat(" ", normalize-space(@class), " "), " entities-list ")]/li[.//div[contains(concat(" ", normalize-space(@class), " "), " discount-amount ") and contains(text(), "100")]]//a"""  # URL: Attribute href
SUBPATH_TITLE = """.//span[contains(concat(" ", normalize-space(@class), " "), " entity-title ")]"""  # /text()
SUBPATH_IMAGE = """.//img"""  # Attr "src"


@dataclass
class RawOffer:
    title: str | None
    url: str | None
    img_url: str | None
    valid_to: str | None = None


class HumbleScraper(Scraper):
    @staticmethod
    def scrape(
        driver: WebDriver, options: dict[str, bool] = None
    ) -> dict[str, list[Offer]]:
        if options and not options[OfferType.GAME.name]:
            return {}

        driver.get(ROOT_URL)

        offers = {}

        logger.info(f"Analyzing {ROOT_URL} for {OfferType.GAME.value} offers")
        offers[OfferType.GAME.name] = HumbleScraper.read_offers_from_page(driver)

        return offers

    @staticmethod
    def read_offers_from_page(driver: WebDriver) -> list[Offer]:
        raw_offers: list[RawOffer] = []

        try:
            # Wait until the page loaded
            WebDriverWait(driver, MAX_WAIT_SECONDS).until(
                EC.presence_of_element_located((By.XPATH, XPATH_FREE_RESULTS))
            )

            offer_elements = driver.find_elements(By.XPATH, XPATH_FREE_RESULTS)
            for offer_element in offer_elements:
                raw_offers.append(HumbleScraper.read_raw_offer(offer_element))

        except WebDriverException:
            logger.info(
                f"Free search results took longer than {MAX_WAIT_SECONDS} to load, probably there are none"
            )

        normalized_offers = HumbleScraper.normalize_offers(raw_offers)

        return normalized_offers

    @staticmethod
    def read_raw_offer(element: WebElement) -> RawOffer:
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

            # Skip some Demo spam in Humble store
            if raw_offer.title.endswith("Demo"):
                continue

            # Raw text
            rawtext = ""
            if raw_offer.title:
                rawtext += f"<title>{raw_offer.title}</title>"

            # Title
            title = raw_offer.title

            nearest_url = raw_offer.url if raw_offer.url else ROOT_URL
            offer = Offer(
                source=Source.HUMBLE,
                duration=OfferDuration.PERMANENT_CLAIMABLE,
                type=OfferType.GAME,
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

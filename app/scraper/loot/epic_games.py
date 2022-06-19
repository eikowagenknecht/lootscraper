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
from app.configparser import Config
from app.scraper.loot.scraper import Scraper
from app.sqlalchemy import Offer

logger = logging.getLogger(__name__)

ROOT_URL = "https://store.epicgames.com/en-US/"

XPATH_CURRENT = (
    """//span[text()="Free Now"]//ancestor::a"""  # xpath href attr is the link
)
# XPATH_COMING_SOON = """//span[text()="Coming Soon"]//ancestor::a"""

SUBPATH_TITLE = """.//span[@data-testid="offer-title-info-title"]/div"""  # /text()
SUBPATH_TIME_FROM = """.//span[@data-testid="offer-title-info-subtitle"]//time[1]"""  # /@datetime  # format 2022-02-24T16:00:00.000Z
SUBPATH_TIME_TO = """.//span[@data-testid="offer-title-info-subtitle"]//time[2]"""  # /@datetime  # format 2022-02-24T16:00:00.000Z
SUBPATH_IMG = """.//img"""


@dataclass
class RawOffer:
    title: str | None
    valid_from: str | None
    valid_to: str | None
    url: str | None
    img_url: str | None


class EpicGamesScraper(Scraper):
    @staticmethod
    def get_source() -> Source:
        return Source.EPIC

    @staticmethod
    def get_type() -> OfferType:
        return OfferType.GAME

    @staticmethod
    def get_duration() -> OfferDuration:
        return OfferDuration.CLAIMABLE

    @staticmethod
    def scrape(driver: WebDriver) -> list[Offer]:
        return EpicGamesScraper.read_offers_from_page(driver)

    @staticmethod
    def read_offers_from_page(driver: WebDriver) -> list[Offer]:
        driver.get(ROOT_URL)
        try:
            # Wait until the page loaded
            WebDriverWait(driver, Scraper.get_max_wait_seconds()).until(
                EC.presence_of_element_located(
                    (By.XPATH, """//h2[text()="Free Games"]""")
                )
            )
        except WebDriverException:
            filename = (
                Config.data_path()
                / f'screenshot_error_{datetime.now().isoformat().replace(".", "_").replace(":", "_")}.png'
            )
            logger.error(
                f"Page took longer than {Scraper.get_max_wait_seconds()} to load. Saving Screenshot to {filename}."
            )
            driver.save_screenshot(str(filename.resolve()))
            return []

        elements: list[WebElement] = []
        try:
            elements.extend(driver.find_elements(By.XPATH, XPATH_CURRENT))
        except WebDriverException:
            logger.warning("No current offer found.")
            pass

        # try:
        #     elements.extend(driver.find_elements(By.XPATH, XPATH_COMING_SOON))
        # except WebDriverException:
        #     logger.warning("No coming offer found.")
        #     pass

        raw_offers: list[RawOffer] = []
        for element in elements:
            raw_offers.append(EpicGamesScraper.read_raw_offer(element))

        normalized_offers = EpicGamesScraper.normalize_offers(raw_offers)

        return normalized_offers

    @staticmethod
    def read_raw_offer(element: WebElement) -> RawOffer:
        title_str = None
        valid_from_str = None
        valid_to_str = None
        url_str = None
        img_url_str = None

        try:
            title_str = str(element.find_element(By.XPATH, SUBPATH_TITLE).text)
        except WebDriverException:
            # Nothing to do here, string stays empty
            pass

        try:
            valid_from_str = str(
                element.find_element(By.XPATH, SUBPATH_TIME_FROM).get_attribute(
                    "datetime"
                )
            )
        except WebDriverException:
            # Nothing to do here, string stays empty
            pass

        try:
            valid_to_str = str(
                element.find_element(By.XPATH, SUBPATH_TIME_TO).get_attribute(
                    "datetime"
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
                element.find_element(By.XPATH, SUBPATH_IMG).get_attribute("src")
            )
        except WebDriverException:
            # Nothing to do here, string stays empty
            pass

        # For current offers, the date is included twice but only means the enddate
        if valid_from_str == valid_to_str:
            valid_from_str = None

        return RawOffer(
            title=title_str,
            valid_from=valid_from_str,
            valid_to=valid_to_str,
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

            if raw_offer.valid_from:
                rawtext += f"<startdate>{raw_offer.valid_from}</startdate>"

            if raw_offer.valid_to:
                rawtext += f"<enddate>{raw_offer.valid_to}</enddate>"

            # Title
            title = raw_offer.title

            # Valid from
            utc_valid_from = None
            if raw_offer.valid_from:
                try:
                    utc_valid_from = datetime.strptime(
                        raw_offer.valid_from,
                        "%Y-%m-%dT%H:%M:%S.000Z",
                    ).replace(tzinfo=timezone.utc)
                except ValueError:
                    utc_valid_from = None

            # Valid to
            utc_valid_to = None
            if raw_offer.valid_to:
                try:
                    utc_valid_to = datetime.strptime(
                        raw_offer.valid_to,
                        "%Y-%m-%dT%H:%M:%S.000Z",
                    ).replace(tzinfo=timezone.utc)
                except ValueError:
                    utc_valid_to = None

            nearest_url = raw_offer.url if raw_offer.url else ROOT_URL
            offer = Offer(
                source=EpicGamesScraper.get_source(),
                duration=EpicGamesScraper.get_duration(),
                type=EpicGamesScraper.get_type(),
                title=title,
                probable_game_name=title,
                seen_last=datetime.now(timezone.utc),
                valid_from=utc_valid_from,
                valid_to=utc_valid_to,
                rawtext=rawtext,
                url=nearest_url,
                img_url=raw_offer.img_url,
            )

            normalized_offers.append(offer)
        return normalized_offers

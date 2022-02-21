import logging
from dataclasses import dataclass
from datetime import datetime

from selenium.common.exceptions import WebDriverException
from selenium.webdriver.chrome.webdriver import WebDriver
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from app.common import LootOffer, OfferType
from app.pagedriver import get_pagedriver

SCRAPER_NAME = "Epic Games"
ROOT_URL = "https://www.epicgames.com/store/en-US/"
MAX_WAIT_SECONDS = 60  # Needs to be quite high in Docker for first run

XPATH_OFFER_HEADER = """//div//*[contains(text(), "Free Games")]"""
XPATH_CURRENT = """//a[contains(@aria-label, "Free Games") and contains(@aria-label, "Free Now")]"""  # xpath href attr is the link
XPATH_COMING_SOON = """//a[contains(@aria-label, "Free Games") and contains(@aria-label, "Coming Soon")]"""

SUBPATH_TITLE = """.//span[@data-testid="offer-title-info-title"]/div"""  # /text()
SUBPATH_TIME_FROM = """.//span[@data-testid="offer-title-info-subtitle"]//time[1]"""  # /@datetime  # format 2022-02-24T16:00:00.000Z
SUBPATH_TIME_TO = """.//span[@data-testid="offer-title-info-subtitle"]//time[2]"""  # /@datetime  # format 2022-02-24T16:00:00.000Z


@dataclass
class RawOffer:
    title: str
    valid_from: str
    valid_to: str
    url: str


class EpicScraper:
    @staticmethod
    def scrape() -> list[LootOffer]:
        logging.info(f"Start scraping of {SCRAPER_NAME}")
        offers = []

        try:
            driver: WebDriver
            with get_pagedriver() as driver:
                driver.get(ROOT_URL)

                logging.info(f"Analyzing {ROOT_URL} for {OfferType.GAME.value} offers")
                offers.extend(EpicScraper.read_offers_from_page(driver))
                driver.quit()
        except WebDriverException as err:  # type: ignore
            logging.error(f"Failure starting Chrome WebDriver, aborting: {err.msg}")  # type: ignore
            raise err

        return offers

    @staticmethod
    def read_offers_from_page(driver: WebDriver) -> list[LootOffer]:
        try:
            # Wait until the page loaded
            WebDriverWait(driver, MAX_WAIT_SECONDS).until(
                EC.presence_of_element_located((By.XPATH, XPATH_OFFER_HEADER))
            )
        except WebDriverException:  # type: ignore
            logging.error(f"Page took longer than {MAX_WAIT_SECONDS} to load")
            return []

        raw_offers: list[RawOffer] = []

        try:
            current_elements: list[WebElement] = driver.find_elements(
                By.XPATH, XPATH_CURRENT
            )
        except WebDriverException:  # type: ignore
            logging.warning("No current offer found.")
            return []

        title: WebElement
        startdate: WebElement
        enddate: WebElement

        for element in current_elements:
            title_str = ""
            startdate_str = ""
            enddate_str = ""
            url_str = ""
            try:
                title = element.find_element(By.XPATH, SUBPATH_TITLE)
                title_str = title.text
            except WebDriverException:  # type: ignore
                # Nothing to do here, string stays empty
                pass

            try:
                enddate = element.find_element(By.XPATH, SUBPATH_TIME_TO)
                enddate_str = enddate.get_attribute("datetime")  # type: ignore
            except WebDriverException:  # type: ignore
                # Nothing to do here, string stays empty
                pass

            try:
                url: str | None = element.get_attribute("href")  # type: ignore
                if url is not None:
                    url_str = url

            except WebDriverException:  # type: ignore
                # Nothing to do here, string stays empty
                pass

            raw_offers.append(RawOffer(title_str, startdate_str, enddate_str, url_str))

        try:
            future_elements: list[WebElement] = driver.find_elements(
                By.XPATH, XPATH_COMING_SOON
            )
        except WebDriverException:  # type: ignore
            logging.warning("No coming offer found.")
            return []

        for element in future_elements:
            title_str = ""
            startdate_str = ""
            enddate_str = ""
            url_str = ""
            try:
                title = element.find_element(By.XPATH, SUBPATH_TITLE)
                title_str = title.text
            except WebDriverException:  # type: ignore
                # Nothing to do here, string stays empty
                pass

            try:
                startdate = element.find_element(By.XPATH, SUBPATH_TIME_FROM)
                startdate_str = startdate.get_attribute("datetime")  # type: ignore
            except WebDriverException:  # type: ignore
                # Nothing to do here, string stays empty
                pass

            try:
                enddate = element.find_element(By.XPATH, SUBPATH_TIME_TO)
                enddate_str = enddate.get_attribute("datetime")  # type: ignore
            except WebDriverException:  # type: ignore
                # Nothing to do here, string stays empty
                pass

            try:
                url: str | None = element.get_attribute("href")  # type: ignore
                if url is not None:
                    url_str = url

            except WebDriverException:  # type: ignore
                # Nothing to do here, string stays empty
                pass

            raw_offers.append(RawOffer(title_str, startdate_str, enddate_str, url_str))

        normalized_offers = EpicScraper.normalize_offers(raw_offers)

        return normalized_offers

    @staticmethod
    def normalize_offers(raw_offers: list[RawOffer]) -> list[LootOffer]:
        normalized_offers: list[LootOffer] = []

        for offer in raw_offers:
            # Raw text
            rawtext = (
                f"<title>{offer.title}</title>"
                f"<startdate>{offer.valid_from}</startdate>"
                f"<enddate>{offer.valid_to}</enddate>"
            )

            # Title
            title = offer.title

            # Valid from
            try:
                utc_startdate = datetime.strptime(
                    offer.valid_from,
                    "%Y-%m-%dT%H:%M:%S.000Z",
                )
            except ValueError:
                utc_startdate = None
            # utc_startdate.replace(tzinfo=timezone.utc).astimezone(tz=None)

            # Valid to
            try:
                utc_enddate = datetime.strptime(
                    offer.valid_to,
                    "%Y-%m-%dT%H:%M:%S.000Z",
                )
            except ValueError:
                utc_enddate = None
            # utc_enddate.replace(tzinfo=timezone.utc).astimezone(tz=None)

            nearest_url = offer.url if offer.url else ROOT_URL
            loot_offer = LootOffer(
                source=SCRAPER_NAME,
                type=OfferType.GAME.value,
                rawtext=rawtext,
                title=title,
                valid_from=utc_startdate,
                valid_to=utc_enddate,
                url=nearest_url,
            )

            normalized_offers.append(loot_offer)
            logging.info(f"Found offer for {loot_offer.title}")
        return normalized_offers

import logging
from dataclasses import dataclass
from datetime import datetime, timezone

from selenium.common.exceptions import WebDriverException
from selenium.webdriver.chrome.webdriver import WebDriver
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from app.common import LootOffer, OfferType, Source
from app.pagedriver import get_pagedriver
from app.scraper.scraper import Scraper

SCRAPER_NAME = "Epic Games"
ROOT_URL = "https://www.epicgames.com/store/en-US/"
MAX_WAIT_SECONDS = 60  # Needs to be quite high in Docker for first run

XPATH_OFFER_HEADER = """//div//*[contains(text(), "Free Games")]"""
XPATH_CURRENT = """//a[contains(@aria-label, "Free Games") and contains(@aria-label, "Free Now")]"""  # xpath href attr is the link
XPATH_COMING_SOON = """//a[contains(@aria-label, "Free Games") and contains(@aria-label, "Coming Soon")]"""

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


class EpicScraper(Scraper):
    @staticmethod
    def scrape(options: dict[str, bool] = None) -> dict[str, list[LootOffer]]:
        if options and not options[OfferType.GAME.name]:
            return {}

        logging.info(f"Start scraping of {SCRAPER_NAME}")

        offers = {}

        try:
            driver: WebDriver
            with get_pagedriver() as driver:
                driver.get(ROOT_URL)

                logging.info(f"Analyzing {ROOT_URL} for {OfferType.GAME.value} offers")
                offers[OfferType.GAME.name] = EpicScraper.read_offers_from_page(driver)

                logging.info("Shutting down driver")
                driver.quit()
            logging.info("Shutdown complete")
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

        elements: list[WebElement] = []
        try:
            elements.extend(driver.find_elements(By.XPATH, XPATH_CURRENT))
        except WebDriverException:  # type: ignore
            logging.warning("No current offer found.")
            pass

        try:
            elements.extend(driver.find_elements(By.XPATH, XPATH_COMING_SOON))
        except WebDriverException:  # type: ignore
            logging.warning("No coming offer found.")
            pass

        raw_offers: list[RawOffer] = []
        for element in elements:
            raw_offers.append(EpicScraper.read_raw_offer(element))

        normalized_offers = EpicScraper.normalize_offers(raw_offers)

        return normalized_offers

    @staticmethod
    def read_raw_offer(element: WebElement) -> RawOffer:
        title_str = None
        valid_from_str = None
        valid_to_str = None
        url_str = None
        img_url_str = None

        try:
            title_str = str(
                element.find_element(By.XPATH, SUBPATH_TITLE).text  # type: ignore
            )
        except WebDriverException:  # type: ignore
            # Nothing to do here, string stays empty
            pass

        try:
            valid_from_str = str(
                element.find_element(By.XPATH, SUBPATH_TIME_FROM).get_attribute(  # type: ignore
                    "datetime"
                )
            )
        except WebDriverException:  # type: ignore
            # Nothing to do here, string stays empty
            pass

        try:
            valid_to_str = str(
                element.find_element(By.XPATH, SUBPATH_TIME_TO).get_attribute(  # type: ignore
                    "datetime"
                )
            )
        except WebDriverException:  # type: ignore
            # Nothing to do here, string stays empty
            pass

        try:
            url_str = str(element.get_attribute("href"))  # type: ignore
        except WebDriverException:  # type: ignore
            # Nothing to do here, string stays empty
            pass

        try:
            img_url_str = str(
                element.find_element(By.XPATH, SUBPATH_IMG).get_attribute("src")  # type: ignore
            )
        except WebDriverException:  # type: ignore
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
    def normalize_offers(raw_offers: list[RawOffer]) -> list[LootOffer]:
        normalized_offers: list[LootOffer] = []

        for offer in raw_offers:
            # Raw text
            rawtext = ""
            if offer.title:
                rawtext += f"<title>{offer.title}</title>"

            if offer.valid_from:
                rawtext += f"<startdate>{offer.valid_from}</startdate>"

            if offer.valid_to:
                rawtext += f"<enddate>{offer.valid_to}</enddate>"

            # Title
            title = offer.title

            # Valid from
            utc_valid_from = None
            if offer.valid_from:
                try:
                    utc_valid_from = datetime.strptime(
                        offer.valid_from,
                        "%Y-%m-%dT%H:%M:%S.000Z",
                    ).replace(tzinfo=timezone.utc)
                except ValueError:
                    utc_valid_from = None

            # Valid to
            utc_valid_to = None
            if offer.valid_to:
                try:
                    utc_valid_to = datetime.strptime(
                        offer.valid_to,
                        "%Y-%m-%dT%H:%M:%S.000Z",
                    ).replace(tzinfo=timezone.utc)
                except ValueError:
                    utc_valid_to = None

            nearest_url = offer.url if offer.url else ROOT_URL
            loot_offer = LootOffer(
                seen_last=datetime.now(timezone.utc),
                source=Source.EPIC,
                type=OfferType.GAME,
                rawtext=rawtext,
                title=title,
                valid_from=utc_valid_from,
                valid_to=utc_valid_to,
                url=nearest_url,
                img_url=offer.img_url,
            )

            normalized_offers.append(loot_offer)
            logging.info(f"Found offer for {loot_offer.title}")
        return normalized_offers

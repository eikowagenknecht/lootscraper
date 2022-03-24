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
from app.scraper.scraper import Scraper

SCRAPER_NAME = "Steam"
ROOT_URL = "https://store.steampowered.com/search/?maxprice=free&specials=1"
MAX_WAIT_SECONDS = 30  # Needs to be quite high in Docker for first run

DETAILS_URL = "https://store.steampowered.com/app/"

STEAM_SEARCH_RESULTS_CONTAINER = '//div[@id = "search_results"]'
STEAM_SEARCH_RESULTS = (
    '//div[@id = "search_result_container"]//a'  # data-ds-appid contains the steam id
)


@dataclass
class RawOffer:
    title: str | None
    appid: int | None
    url: str | None


class SteamScraper(Scraper):
    @staticmethod
    def scrape(
        driver: WebDriver, options: dict[str, bool] = None
    ) -> dict[str, list[LootOffer]]:
        if options and not options[OfferType.GAME.name]:
            return {}

        logging.info(f"Analyzing {ROOT_URL} for {OfferType.GAME.value} offers")
        driver.get(ROOT_URL)
        offers = {}
        offers[OfferType.GAME.name] = SteamScraper.read_offers_from_page(driver)

        return offers

    @staticmethod
    def read_offers_from_page(driver: WebDriver) -> list[LootOffer]:
        try:
            # Wait until the page loaded
            WebDriverWait(driver, MAX_WAIT_SECONDS).until(
                EC.presence_of_element_located(
                    (By.XPATH, STEAM_SEARCH_RESULTS_CONTAINER)
                )
            )
        except WebDriverException:  # type: ignore
            logging.error(f"Page took longer than {MAX_WAIT_SECONDS} to load")
            return []

        elements: list[WebElement] = []
        try:
            elements.extend(driver.find_elements(By.XPATH, STEAM_SEARCH_RESULTS))
        except WebDriverException:  # type: ignore
            logging.info("No current offer found.")
            pass

        raw_offers: list[RawOffer] = []
        for element in elements:
            raw_offers.append(SteamScraper.read_raw_offer(element))

        normalized_offers = SteamScraper.normalize_offers(raw_offers)

        return normalized_offers

    @staticmethod
    def read_raw_offer(element: WebElement) -> RawOffer:
        title_str: str | None = None
        appid: int | None = None
        url_str: str | None = None

        try:
            title_element = element.find_element(By.CLASS_NAME, "title")  # type: ignore
            title_str = title_element.text  # type: ignore
        except WebDriverException:  # type: ignore
            # Nothing to do here, string stays empty
            pass

        try:
            appid = int(element.get_attribute("data-ds-appid"))  # type: ignore
            url_str = DETAILS_URL + str(appid)
        except (WebDriverException, ValueError):  # type: ignore
            # Nothing to do here, string stays empty
            pass

        return RawOffer(
            appid=appid,
            title=title_str,
            url=url_str,
        )

    @staticmethod
    def normalize_offers(raw_offers: list[RawOffer]) -> list[LootOffer]:
        normalized_offers: list[LootOffer] = []

        for offer in raw_offers:
            # Raw text
            rawtext = ""
            if offer.title:
                rawtext += f"<title>{offer.title}</title>"

            if offer.appid:
                rawtext += f"<appid>{offer.appid}</appid>"

            # Title
            title = offer.title

            nearest_url = offer.url if offer.url else ROOT_URL
            loot_offer = LootOffer(
                seen_last=datetime.now(timezone.utc),
                source=Source.STEAM,
                type=OfferType.GAME,
                rawtext=rawtext,
                title=title,
                valid_from=None,
                valid_to=None,
                url=nearest_url,
                img_url=None,
            )

            normalized_offers.append(loot_offer)
        return normalized_offers

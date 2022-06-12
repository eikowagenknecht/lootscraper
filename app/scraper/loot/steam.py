import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from selenium.common.exceptions import WebDriverException
from selenium.webdriver.chrome.webdriver import WebDriver
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from app.common import OfferType, Source
from app.scraper.info.steam import skip_age_verification
from app.scraper.loot.scraper import Scraper
from app.sqlalchemy import Offer

logger = logging.getLogger(__name__)

SCRAPER_NAME = "Steam"
ROOT_URL = "https://store.steampowered.com/search/?maxprice=free&specials=1"
MAX_WAIT_SECONDS = 15  # Needs to be quite high in Docker for first run

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
    text: str | None = None


class SteamScraper(Scraper):
    @staticmethod
    def scrape(
        driver: WebDriver, options: dict[str, bool] = None
    ) -> dict[str, list[Offer]]:
        if options and not options[OfferType.GAME.name]:
            return {}

        driver.get(ROOT_URL)

        offers = {}

        logger.info(f"Analyzing {ROOT_URL} for {OfferType.GAME.value} offers")
        offers[OfferType.GAME.name] = SteamScraper.read_offers_from_page(driver)

        return offers

    @staticmethod
    def read_offers_from_page(driver: WebDriver) -> list[Offer]:
        try:
            # Wait until the page loaded
            WebDriverWait(driver, MAX_WAIT_SECONDS).until(
                EC.presence_of_element_located(
                    (By.XPATH, STEAM_SEARCH_RESULTS_CONTAINER)
                )
            )
        except WebDriverException:
            logger.error(f"Page took longer than {MAX_WAIT_SECONDS} to load")
            return []

        elements: list[WebElement] = []
        try:
            elements.extend(driver.find_elements(By.XPATH, STEAM_SEARCH_RESULTS))
        except WebDriverException:
            logger.info("No current offer found.")
            pass

        raw_offers: list[RawOffer] = []
        for element in elements:
            raw_offer = SteamScraper.read_raw_offer(element)
            raw_offers.append(raw_offer)

        for raw_offer in raw_offers:
            try:
                driver.get(raw_offer.url)
                skip_age_verification(driver, raw_offer.appid if raw_offer.appid else 0)
                WebDriverWait(driver, MAX_WAIT_SECONDS).until(
                    EC.presence_of_element_located(
                        (By.CLASS_NAME, "game_area_purchase")
                    )
                )

                element = driver.find_element(
                    By.CLASS_NAME, "game_purchase_discount_quantity"
                )
                raw_offer.text = element.text
            except WebDriverException:
                # Text is optional, continue away
                pass

        normalized_offers = SteamScraper.normalize_offers(raw_offers)

        return normalized_offers

    @staticmethod
    def read_raw_offer(element: WebElement) -> RawOffer:
        title_str: str | None = None
        appid: int | None = None
        url_str: str | None = None

        try:
            title_element = element.find_element(By.CLASS_NAME, "title")
            title_str = title_element.text
        except WebDriverException:
            # Nothing to do here, string stays empty
            pass

        try:
            appid = int(element.get_attribute("data-ds-appid"))  # type: ignore
            url_str = DETAILS_URL + str(appid)
        except (WebDriverException, ValueError):
            # Nothing to do here, string stays empty
            pass

        return RawOffer(
            appid=appid,
            title=title_str,
            url=url_str,
        )

    @staticmethod
    def normalize_offers(raw_offers: list[RawOffer]) -> list[Offer]:
        normalized_offers: list[Offer] = []

        now = datetime.now(timezone.utc)

        for raw_offer in raw_offers:
            # Raw text
            rawtext = ""
            if raw_offer.title:
                rawtext += f"<title>{raw_offer.title}</title>"

            if raw_offer.appid:
                rawtext += f"<appid>{raw_offer.appid}</appid>"

            if raw_offer.text:
                rawtext += f"<text>{raw_offer.text}</text>"

            # Valid from date
            valid_to: datetime | None = None
            if raw_offer.text:
                maybe_date = raw_offer.text.removeprefix(
                    "Free to keep when you get it before "
                ).removesuffix(". Some limitations apply. (?)")
                try:
                    valid_to = (
                        datetime.strptime(maybe_date, "%d %b @ %I:%M%p")
                        .replace(tzinfo=timezone.utc)
                        .replace(year=now.year)
                    )
                    # Date has to be in the future, adjust the year accordingly
                    yesterday = now - timedelta(days=1)
                    if valid_to < yesterday:
                        valid_to = valid_to.replace(year=valid_to.year + 1)
                except ValueError:
                    logger.warning(f"Couldn't parse date {maybe_date}")

            # Title
            title = raw_offer.title

            nearest_url = raw_offer.url if raw_offer.url else ROOT_URL
            offer = Offer(
                source=Source.STEAM,
                type=OfferType.GAME,
                title=title,
                probable_game_name=title,
                seen_last=now,
                valid_from=None,
                valid_to=valid_to,
                rawtext=rawtext,
                url=nearest_url,
                img_url=None,
            )

            normalized_offers.append(offer)
        return normalized_offers

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from selenium.common.exceptions import WebDriverException
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from app.common import OfferDuration, OfferType, Source
from app.scraper.info.steam import skip_age_verification
from app.scraper.info.utils import clean_game_title
from app.scraper.loot.scraper import RawOffer, Scraper
from app.sqlalchemy import Offer

logger = logging.getLogger(__name__)

SCRAPER_NAME = "Steam"
ROOT_URL = (
    "https://store.steampowered.com/search/?maxprice=free&category1=998&specials=1"
)

DETAILS_URL = "https://store.steampowered.com/app/"

STEAM_SEARCH_RESULTS_CONTAINER = '//div[@id = "search_results"]'
STEAM_SEARCH_RESULTS = (
    '//div[@id = "search_result_container"]//a'  # data-ds-appid contains the steam id
)


@dataclass
class SteamRawOffer(RawOffer):
    appid: int | None = None
    text: str | None = None


class SteamGamesScraper(Scraper):
    @staticmethod
    def get_source() -> Source:
        return Source.STEAM

    @staticmethod
    def get_type() -> OfferType:
        return OfferType.GAME

    @staticmethod
    def get_duration() -> OfferDuration:
        return OfferDuration.CLAIMABLE

    def read_offers_from_page(self) -> list[Offer]:
        self.driver.get(ROOT_URL)
        try:
            # Wait until the page loaded
            WebDriverWait(self.driver, Scraper.get_max_wait_seconds()).until(
                EC.presence_of_element_located(
                    (By.XPATH, STEAM_SEARCH_RESULTS_CONTAINER)
                )
            )
        except WebDriverException:
            logger.error(
                f"Page took longer than {Scraper.get_max_wait_seconds()} to load"
            )
            return []

        elements: list[WebElement] = []
        try:
            elements.extend(self.driver.find_elements(By.XPATH, STEAM_SEARCH_RESULTS))
        except WebDriverException:
            logger.info("No current offer found.")
            pass

        raw_offers: list[SteamRawOffer] = []
        for element in elements:
            raw_offer = SteamGamesScraper.read_raw_offer(element)
            raw_offers.append(raw_offer)

        for raw_offer in raw_offers:
            try:
                self.driver.get(raw_offer.url)
                skip_age_verification(
                    self.driver, raw_offer.appid if raw_offer.appid else 0
                )
                WebDriverWait(self.driver, Scraper.get_max_wait_seconds()).until(
                    EC.presence_of_element_located(
                        (By.CLASS_NAME, "game_area_purchase")
                    )
                )

                element = self.driver.find_element(
                    By.CLASS_NAME, "game_purchase_discount_quantity"
                )
                raw_offer.text = element.text
            except WebDriverException:
                # Text is optional, continue away
                pass

        normalized_offers = SteamGamesScraper.normalize_offers(raw_offers)

        return normalized_offers

    @staticmethod
    def read_raw_offer(element: WebElement) -> SteamRawOffer:
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

        return SteamRawOffer(appid=appid, title=title_str, url=url_str, img_url=None)

    @staticmethod
    def normalize_offers(raw_offers: list[SteamRawOffer]) -> list[Offer]:
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

            # Probable game name
            if not raw_offer.title:
                probable_game_name = None
            else:
                probable_game_name = clean_game_title(raw_offer.title)

            nearest_url = raw_offer.url if raw_offer.url else ROOT_URL
            offer = Offer(
                source=SteamGamesScraper.get_source(),
                duration=SteamGamesScraper.get_duration(),
                type=SteamGamesScraper.get_type(),
                title=raw_offer.title,
                probable_game_name=probable_game_name,
                seen_last=now,
                valid_from=None,
                valid_to=valid_to,
                rawtext=rawtext,
                url=nearest_url,
                img_url=None,
            )

            normalized_offers.append(offer)
        return normalized_offers

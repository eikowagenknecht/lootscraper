import logging
from asyncio import sleep
from dataclasses import dataclass
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

ROOT_URL = "https://www.gog.com/#giveaway"

XPATH_PAGE_LOADED = """//div[@class="content cf"]"""

XPATH_SWITCH_TO_ENGLISH = """//li[contains(concat(" ", normalize-space(@class), " "), " footer-microservice-language__item ")][1]"""
XPATH_SELECTED_LANGUAGE = """//li[contains(concat(" ", normalize-space(@class), " "), " footer-microservice-language__item is-selected ")]"""

# Variant 1
XPATH_GIVEAWAY = """//a[contains(concat(" ", normalize-space(@class), " "), " giveaway-banner ")]"""  # URL: Attribute href
SUBPATH_TITLE = """.//span[contains(concat(" ", normalize-space(@class), " "), " giveaway-banner__title ")]"""
SUBPATH_IMAGE = """.//div[contains(concat(" ", normalize-space(@class), " "), " giveaway-banner__image ")]//source[@type="image/png" and not(@media)]"""  # Attribute srcset, first entry without the "2x text + root url"
SUBPATH_VALID_TO = """.//gog-countdown-timer"""  # Attr "end-date" without the last 3 digits (000) is the timestamp in unixtime

# Variant 2 ("Big Box")
XPATH_BB_GIVEAWAY = """//a[contains(concat(" ", normalize-space(@class), " "), " big-spot ")]"""  # URL: Attribute href
SUBPATH_BB_PRICE = """.//*[contains(concat(" ", normalize-space(@ng-if), " "), " tile.isFreeVisible ")]"""  # Price


@dataclass
class GogRawOffer(RawOffer):
    valid_to: str | None = None


class GogGamesScraper(Scraper):
    @staticmethod
    def get_source() -> Source:
        return Source.GOG

    @staticmethod
    def get_type() -> OfferType:
        return OfferType.GAME

    @staticmethod
    def get_duration() -> OfferDuration:
        return OfferDuration.CLAIMABLE

    async def read_offers_from_page(self) -> list[Offer]:
        self.context.get(ROOT_URL)
        try:
            # Wait until the page loaded
            WebDriverWait(self.context, Scraper.get_max_wait_seconds()).until(
                EC.presence_of_element_located((By.XPATH, XPATH_PAGE_LOADED))
            )
        except WebDriverException:
            logger.error(
                f"Page took longer than {Scraper.get_max_wait_seconds()} to load"
            )
            return []

        try:
            # Switch to english version
            en = self.context.find_element(By.XPATH, XPATH_SWITCH_TO_ENGLISH)
            en.click()
            await sleep(2)  # Wait for the language switching to begin
            # Check if it's really english now
            en_test = self.context.find_element(By.XPATH, XPATH_SELECTED_LANGUAGE)
            if en_test.text != "English":
                logger.error(
                    f"Tried switching to English, but {en_test.text} is active instead"
                )
                return []
        except WebDriverException:
            logger.error("Couldn't switch to English")
            return []

        raw_offers: list[GogRawOffer] = []

        # Check giveaway variant 1
        try:
            # Wait until the page loaded
            WebDriverWait(self.context, Scraper.get_max_wait_seconds()).until(
                EC.presence_of_element_located((By.XPATH, XPATH_GIVEAWAY))
            )

            offer_element = self.context.find_element(By.XPATH, XPATH_GIVEAWAY)
            raw_offers.append(GogGamesScraper.read_raw_offer(offer_element))
        except WebDriverException:
            logger.info(
                f"Giveaways (v1) took longer than {Scraper.get_max_wait_seconds()} to load, probably there are none"
            )

        # Check giveaway variant 2
        try:
            # Wait until the page loaded
            WebDriverWait(self.context, Scraper.get_max_wait_seconds()).until(
                EC.presence_of_element_located((By.XPATH, XPATH_BB_GIVEAWAY))
            )

            offer_elements = self.context.find_elements(By.XPATH, XPATH_BB_GIVEAWAY)
            offer_urls: list[str] = []
            for el in offer_elements:
                try:
                    price = el.find_element(By.XPATH, SUBPATH_BB_PRICE)
                except WebDriverException:
                    continue
                value = price.get_attribute("textContent")
                if "free" not in value:
                    continue
                try:
                    url = str(el.get_attribute("href"))  # type: ignore
                    offer_urls.append(url)
                except WebDriverException:
                    logger.warning("Could not read url for GOG variant 2")
                    continue
            for url in offer_urls:
                raw_offers.append(self.read_offer_from_details_page(url))

        except WebDriverException:
            logger.info(
                f"Giveaways (v2) took longer than {Scraper.get_max_wait_seconds()} to load, probably there are none"
            )

        normalized_offers = GogGamesScraper.normalize_offers(raw_offers)

        return normalized_offers

    @staticmethod
    def read_raw_offer(element: WebElement) -> GogRawOffer:
        title_str = None
        valid_to_str = None
        url_str = None
        img_url_str = None

        try:
            title_str = str(element.find_element(By.XPATH, SUBPATH_TITLE).text)
            title_str = title_str.removeprefix("Claim ")
            title_str = title_str.removesuffix(
                " and don't miss the best GOG offers in the future!"
            )
        except WebDriverException:
            # Nothing to do here, string stays empty
            pass

        try:
            valid_to_str = str(
                element.find_element(By.XPATH, SUBPATH_VALID_TO).get_attribute(
                    "end-date"
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
                element.find_element(By.XPATH, SUBPATH_IMAGE).get_attribute("srcset")
            )
            img_url_str = "https:" + (
                img_url_str.split(",", maxsplit=1)[0]
                .strip()
                .removesuffix(" 2x")
                .removesuffix(" 1x")
            )
        except WebDriverException:
            # Nothing to do here, string stays empty
            pass

        # For current offers, the date is included twice but only means the enddate

        return GogRawOffer(
            title=title_str,
            valid_to=valid_to_str,
            url=url_str,
            img_url=img_url_str,
        )

    def read_offer_from_details_page(self, url: str) -> GogRawOffer:
        title_str = None
        img_url_str = None

        self.context.get(url)

        try:
            title_str = str(
                self.context.find_element(
                    By.CLASS_NAME, "productcard-basics__title"
                ).text
            )
        except WebDriverException:
            # Nothing to do here, string stays empty
            pass

        try:
            img_url_str = str(
                self.context.find_element(
                    By.CLASS_NAME, "productcard-player__logo"
                ).get_attribute(
                    "srcset"
                )  # type: ignore
            )
            img_url_str = (
                img_url_str.split(",", maxsplit=1)[0]
                .strip()
                .removesuffix(" 2x")
                .removesuffix(" 1x")
            )
        except WebDriverException:
            # Nothing to do here, string stays empty
            pass

        return GogRawOffer(
            url=url,
            title=title_str,
            img_url=img_url_str,
        )

    @staticmethod
    def normalize_offers(raw_offers: list[GogRawOffer]) -> list[Offer]:
        normalized_offers: list[Offer] = []

        for raw_offer in raw_offers:
            # Raw text
            if not raw_offer.title:
                logger.error(f"Error with offer, has no title: {raw_offer}")
                continue

            rawtext = f"<title>{raw_offer.title}</title>"

            if raw_offer.valid_to:
                rawtext += f"<enddate>{raw_offer.valid_to}</enddate>"

            # Title
            # Contains additional text that needs to be stripped
            title = raw_offer.title

            # Valid to
            valid_to_stamp = None
            if raw_offer.valid_to:
                try:
                    valid_to_unix = int(raw_offer.valid_to) / 1000
                    valid_to_stamp = datetime.utcfromtimestamp(valid_to_unix).replace(
                        tzinfo=timezone.utc
                    )
                except ValueError:
                    valid_to_stamp = None

            nearest_url = raw_offer.url if raw_offer.url else ROOT_URL
            offer = Offer(
                source=GogGamesScraper.get_source(),
                duration=GogGamesScraper.get_duration(),
                type=GogGamesScraper.get_type(),
                title=title,
                probable_game_name=title,
                seen_last=datetime.now(timezone.utc),
                valid_to=valid_to_stamp,
                rawtext=rawtext,
                url=nearest_url,
                img_url=raw_offer.img_url,
            )

            normalized_offers.append(offer)

        return normalized_offers

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from time import sleep

from selenium.common.exceptions import WebDriverException
from selenium.webdriver.chrome.webdriver import WebDriver
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from app.common import LootOffer, OfferType, Source
from app.scraper.loot.scraper import Scraper

SCRAPER_NAME = "GOG"
ROOT_URL = "https://www.gog.com/#giveaway"
MAX_WAIT_SECONDS = 60  # Needs to be quite high in Docker for first run

XPATH_PAGE_LOADED = """//div[@class="content cf"]"""
XPATH_GIVEAWAY = """//a[contains(concat(" ", normalize-space(@class), " "), " giveaway-banner ")]"""  # URL: Attribute href
XPATH_SWITCH_TO_ENGLISH = """//li[@class="footer-microservice-language__item"][1]"""
SUBPATH_TITLE = """.//span[contains(concat(" ", normalize-space(@class), " "), " giveaway-banner__title ")]"""
SUBPATH_IMAGE = """.//div[contains(concat(" ", normalize-space(@class), " "), " giveaway-banner__image ")]//source[@type="image/png" and not(@media)]"""  # Attribute srcset, first entry without the "2x text + root url"
SUBPATH_VALID_TO = """.//gog-countdown-timer"""  # Attr "end-date" without the last 3 digits (000) is the timestamp in unixtime


@dataclass
class RawOffer:
    title: str | None
    valid_to: str | None
    url: str | None
    img_url: str | None


class GogScraper(Scraper):
    @staticmethod
    def scrape(
        driver: WebDriver, options: dict[str, bool] = None
    ) -> dict[str, list[LootOffer]]:
        if options and not options[OfferType.GAME.name]:
            return {}

        driver.get(ROOT_URL)

        offers = {}

        logging.info(f"Analyzing {ROOT_URL} for {OfferType.GAME.value} offers")
        offers[OfferType.GAME.name] = GogScraper.read_offers_from_page(driver)

        return offers

    @staticmethod
    def read_offers_from_page(driver: WebDriver) -> list[LootOffer]:
        try:
            # Wait until the page loaded
            WebDriverWait(driver, MAX_WAIT_SECONDS).until(
                EC.presence_of_element_located((By.XPATH, XPATH_PAGE_LOADED))
            )
        except WebDriverException:
            logging.error(f"Page took longer than {MAX_WAIT_SECONDS} to load")
            return []

        try:
            # Switch to english version
            en = driver.find_element(By.XPATH, XPATH_SWITCH_TO_ENGLISH)
            en.click()
            sleep(1)  # Wait for the language switching to begin
        except WebDriverException:
            logging.error("Couldn't switch to English")
            return []

        try:
            # Wait until the page loaded
            WebDriverWait(driver, MAX_WAIT_SECONDS).until(
                EC.presence_of_element_located((By.XPATH, XPATH_GIVEAWAY))
            )
        except WebDriverException:
            logging.info(
                f"Giveaways took longer than {MAX_WAIT_SECONDS} to load, probably there are none"
            )
            return []

        offer_element = driver.find_element(By.XPATH, XPATH_GIVEAWAY)

        raw_offers: list[RawOffer] = []
        raw_offers.append(GogScraper.read_raw_offer(offer_element))

        normalized_offers = GogScraper.normalize_offers(raw_offers)

        return normalized_offers

    @staticmethod
    def read_raw_offer(element: WebElement) -> RawOffer:
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

            if offer.valid_to:
                rawtext += f"<enddate>{offer.valid_to}</enddate>"

            # Title
            # Contains additional text that needs to be stripped
            title = offer.title

            # Valid to
            valid_to_stamp = None
            if offer.valid_to:
                try:
                    valid_to_unix = int(offer.valid_to) / 1000
                    valid_to_stamp = datetime.utcfromtimestamp(valid_to_unix).replace(
                        tzinfo=timezone.utc
                    )
                except ValueError:
                    valid_to_stamp = None

            nearest_url = offer.url if offer.url else ROOT_URL
            loot_offer = LootOffer(
                seen_last=datetime.now(timezone.utc),
                source=Source.GOG,
                type=OfferType.GAME,
                rawtext=rawtext,
                title=title,
                valid_to=valid_to_stamp,
                url=nearest_url,
                img_url=offer.img_url,
            )

            if title is not None and len(title) > 0:
                normalized_offers.append(loot_offer)
        return normalized_offers
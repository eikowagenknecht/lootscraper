from selenium.webdriver.chrome.webdriver import WebDriver

from app.common import OfferDuration, OfferType, Source
from app.sqlalchemy import Offer

MAX_WAIT_SECONDS = 15  # Needs to be quite high in Docker for first run


class Scraper:
    @staticmethod
    def scrape(driver: WebDriver) -> list[Offer]:
        raise NotImplementedError("Please implement this method")

    @staticmethod
    def get_type() -> OfferType:
        raise NotImplementedError("Please implement this method")

    @staticmethod
    def get_source() -> Source:
        raise NotImplementedError("Please implement this method")

    @staticmethod
    def get_duration() -> OfferDuration:
        raise NotImplementedError("Please implement this method")

    @staticmethod
    def get_max_wait_seconds() -> int:
        return MAX_WAIT_SECONDS

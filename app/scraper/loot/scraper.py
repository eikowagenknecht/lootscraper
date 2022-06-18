from selenium.webdriver.chrome.webdriver import WebDriver

from app.common import OfferDuration, OfferType, Source
from app.sqlalchemy import Offer


class Scraper:
    @staticmethod
    def scrape(driver: WebDriver) -> dict[str, list[Offer]]:
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

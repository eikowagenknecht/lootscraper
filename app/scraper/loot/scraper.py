from __future__ import annotations

from time import sleep

from selenium.webdriver.chrome.webdriver import WebDriver

from app.common import OfferDuration, OfferType, Source
from app.sqlalchemy import Offer

MAX_WAIT_SECONDS = 15  # Needs to be quite high in Docker for first run
SCROLL_PAUSE_SECONDS = 0.5


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

    @staticmethod
    def scroll_to_infinite_bottom(driver: WebDriver) -> None:
        """Scroll down to the bottom of the current page. Useful for pages with infinite scrolling."""

        # Get scroll height
        last_height = driver.execute_script("return document.body.scrollHeight")  # type: ignore

        scolled_x_times = 0

        while True:
            # Scroll down to bottom
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")  # type: ignore

            # Wait to load page
            sleep(SCROLL_PAUSE_SECONDS)

            # Calculate new scroll height and compare with last scroll height
            new_height = driver.execute_script("return document.body.scrollHeight")  # type: ignore
            if new_height == last_height:
                break
            last_height = new_height

            # Do not scroll more than 100 times, something is wrong here!
            if scolled_x_times > 100:
                break

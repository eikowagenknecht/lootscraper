from __future__ import annotations

from time import sleep

from selenium.webdriver.chrome.webdriver import WebDriver

from app.common import OfferDuration, OfferType, Source
from app.sqlalchemy import Offer

MAX_WAIT_SECONDS = 15  # Needs to be quite high in Docker for first run
SCROLL_PAUSE_SECONDS = 1  # Long enough so even Amazons JS can catch up


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
    def scroll_to_infinite_bottom(
        driver: WebDriver, element_id: str | None = None
    ) -> None:
        """Scroll down to the bottom of the current page. Useful for pages with infinite scrolling."""

        if element_id:
            selector = f'document.getElementById("{element_id}")'
        else:
            selector = "document.body"

        # Get scroll height
        position = driver.execute_script(f"return {selector}.scrollTop")  # type: ignore

        scolled_x_times = 0

        while True:
            # Wait to load page. We do this first to give the page time for the initial load
            sleep(SCROLL_PAUSE_SECONDS)

            # Scroll down to bottom
            driver.execute_script(f"{selector}.scrollTo(0, {position + 800});")  # type: ignore

            # Calculate new scroll height and compare with last scroll height
            new_position = driver.execute_script(f"return {selector}.scrollTop")  # type: ignore
            if new_position == position:
                break
            position = new_position

            # Do not scroll more than 100 times, something is wrong here!
            if scolled_x_times > 100:
                break

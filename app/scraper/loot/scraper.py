from __future__ import annotations

from dataclasses import dataclass
from time import sleep

from selenium.webdriver.chrome.webdriver import WebDriver

from app.common import OfferDuration, OfferType, Source
from app.sqlalchemy import Offer

MAX_WAIT_SECONDS = 15  # Needs to be quite high in Docker for first run
SCROLL_PAUSE_SECONDS = 1  # Long enough so even Amazons JS can catch up


@dataclass
class RawOffer:
    title: str | None
    url: str | None = None
    img_url: str | None = None


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
    def scroll_element_to_bottom(driver: WebDriver, element_id: str) -> None:
        """Scroll down to the bottom of the given alement. Useful for pages with infinite scrolling."""

        selector = f'document.getElementById("{element_id}")'

        # Get scroll height
        position = driver.execute_script(f"return {selector}.scrollTop")  # type: ignore
        scroll_amount = int(
            driver.execute_script(f"return {selector}.clientHeight") * 0.8  # type: ignore
        )

        scolled_x_times = 0

        while True:
            # Wait to load page. We do this first to give the page time for the initial load
            sleep(SCROLL_PAUSE_SECONDS)

            # Scroll down to bottom
            driver.execute_script(f"{selector}.scrollTo(0, {position + scroll_amount});")  # type: ignore

            # Calculate new scroll height and compare with last scroll height
            new_position = driver.execute_script(f"return {selector}.scrollTop")  # type: ignore
            if new_position == position:
                break
            position = new_position

            # Do not scroll more than 100 times, something is wrong here!
            if scolled_x_times > 100:
                break

    @staticmethod
    def scroll_page_to_bottom(driver: WebDriver) -> None:
        """Scroll down to the bottom of the current page. Useful for pages with infinite scrolling."""

        # Get scroll height
        height = driver.execute_script("return document.body.scrollHeight")  # type: ignore

        scolled_x_times = 0

        while True:
            # Wait to load page. We do this first to give the page time for the initial load
            sleep(SCROLL_PAUSE_SECONDS)

            # Scroll down to bottom
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")  # type: ignore

            # Calculate new scroll height and compare with last scroll height
            new_height = driver.execute_script("return document.body.scrollHeight")  # type: ignore
            if new_height == height:
                break
            height = new_height

            # Do not scroll more than 100 times, something is wrong here!
            if scolled_x_times > 100:
                break

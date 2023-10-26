import asyncio

import schedule
from playwright.async_api import Page

from lootscraper.common import OfferType, Source
from lootscraper.scraper.scraper_base import Scraper


class GogBaseScraper(Scraper):
    @staticmethod
    def get_source() -> Source:
        return Source.GOG

    @staticmethod
    def get_type() -> OfferType:
        return OfferType.GAME

    @staticmethod
    def get_schedule() -> list[schedule.Job]:
        return [schedule.every(30).minutes]

    @staticmethod
    def sanitize_img_url(img_url: str | None) -> str | None:
        if img_url is None:
            return None
        img_url = (
            img_url.strip()
            .split(",", maxsplit=1)[0]
            .strip()
            .removesuffix(" 2x")
            .removesuffix(" 1x")
        )
        if not img_url.startswith("https:"):
            img_url = "https:" + img_url
        return img_url

    @staticmethod
    async def switch_to_english(page: Page) -> None:
        # Check if we're already on English version
        current_language = await GogBaseScraper.get_current_language(page)
        if current_language == "English":
            return

        await page.locator("li.footer-microservice-language__item").first.click()
        # Give the language switching some time
        await asyncio.sleep(1)

        # Check if it's really English now
        current_language = await GogBaseScraper.get_current_language(page)
        if current_language != "English":
            raise ValueError(
                f"Tried switching to English, but {current_language} is active "
                "instead.",
            )

    @staticmethod
    async def get_current_language(page: Page) -> str | None:
        return await page.locator(
            "li.footer-microservice-language__item.is-selected",
        ).text_content()

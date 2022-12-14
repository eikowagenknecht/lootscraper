import asyncio

from playwright.async_api import Page

from app.common import OfferType, Source
from app.scraper.loot.scraper import Scraper


class GogBaseScraper(Scraper):  # pylint: disable=W0223
    @staticmethod
    def get_source() -> Source:
        return Source.GOG

    @staticmethod
    def get_type() -> OfferType:
        return OfferType.GAME

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
        # Switch to english version
        en = page.locator("li.footer-microservice-language__item").first
        await en.click()
        await asyncio.sleep(2)  # Wait for the language switching to begin
        # Check if it's really english now
        current_language = await page.locator(
            "li.footer-microservice-language__item.is-selected"
        ).text_content()
        if current_language != "English":
            raise ValueError(
                f"Tried switching to English, but {current_language} is active instead."
            )

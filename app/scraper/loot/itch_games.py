import logging
from datetime import datetime, timezone

from playwright.async_api import Error, Locator

from app.common import OfferDuration, OfferType, Source
from app.pagedriver import get_new_page
from app.scraper.loot.scraper import RawOffer, Scraper
from app.sqlalchemy import Offer

logger = logging.getLogger(__name__)

BASE_URL = "https://itch.io"
OFFER_URL = BASE_URL + "/games/new-and-popular/on-sale"


class ItchGamesScraper(Scraper):
    @staticmethod
    def get_source() -> Source:
        return Source.ITCH

    @staticmethod
    def get_type() -> OfferType:
        return OfferType.GAME

    @staticmethod
    def get_duration() -> OfferDuration:
        return OfferDuration.CLAIMABLE

    async def read_offers_from_page(self) -> list[Offer]:
        raw_offers: list[RawOffer] = []

        async with get_new_page(self.context) as page:
            await page.goto(OFFER_URL)

            try:
                await page.wait_for_selector(".game_grid_widget .game_cell")
                await ItchGamesScraper.scroll_page_to_bottom(page)

                # XPATH_FREE_RESULTS = """//div[contains(concat(" ", normalize-space(@class), " "), " game_cell ") and .//div[@class="sale_tag" and contains(text(), "100")]]"""  # URL: Attribute href

                elements = page.locator(
                    ".game_grid_widget .game_cell",
                    has=page.locator(".sale_tag", has_text="100"),
                )

                try:
                    no_res = await elements.count()
                except Error as e:
                    logger.error(f"Root element not found, could not scrape: {e}")
                    return []

                for i in range(no_res):
                    element = elements.nth(i)
                    try:
                        raw_offers.append(
                            await ItchGamesScraper.read_raw_offer(element)
                        )
                    except (Error, ValueError) as e:
                        logger.error(f"Element could not be read: {e}")
                        continue
            except Error as e:
                logger.error(f"Page could not be read, could not scrape: {e}")
                return []

        normalized_offers = ItchGamesScraper.normalize_offers(raw_offers)

        return normalized_offers

    @staticmethod
    async def read_raw_offer(element: Locator) -> RawOffer:
        # Scroll into view to mage sure the image is loaded
        await element.scroll_into_view_if_needed()
        title = await element.locator("a.title").text_content()
        if title is None:
            raise ValueError("a.title is None")
        url = await element.locator("a.title").get_attribute("href")
        if url is None:
            raise ValueError("a.title[href] is None")
        img_url = await element.locator("img").get_attribute("src")
        if img_url is None:
            raise ValueError("img[src] is None")

        return RawOffer(
            title=title,
            url=url,
            img_url=img_url,
        )

    @staticmethod
    def normalize_offers(raw_offers: list[RawOffer]) -> list[Offer]:
        normalized_offers: list[Offer] = []

        for raw_offer in raw_offers:
            # Raw text
            rawtext = f"<title>{raw_offer.title}</title>"

            # Title
            # Contains additional text that needs to be stripped
            title = raw_offer.title

            # Valid to
            nearest_url = raw_offer.url if raw_offer.url else OFFER_URL
            offer = Offer(
                source=ItchGamesScraper.get_source(),
                duration=ItchGamesScraper.get_duration(),
                type=ItchGamesScraper.get_type(),
                title=title,
                probable_game_name=title,
                seen_last=datetime.now(timezone.utc),
                rawtext=rawtext,
                url=nearest_url,
                img_url=raw_offer.img_url,
            )

            normalized_offers.append(offer)

        return normalized_offers

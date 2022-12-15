import logging
from datetime import datetime, timezone

from playwright.async_api import Error, Locator

from app.common import Category, OfferDuration, OfferType, Source
from app.pagedriver import get_new_page
from app.scraper.loot.scraper import RawOffer, Scraper
from app.sqlalchemy import Offer

logger = logging.getLogger(__name__)

BASE_URL = "https://appagg.com"
OFFER_URL = BASE_URL + "/sale/android-games/free/?hl=en"


class GoogleGamesScraper(Scraper):
    @staticmethod
    def get_source() -> Source:
        return Source.GOOGLE

    @staticmethod
    def get_type() -> OfferType:
        return OfferType.GAME

    @staticmethod
    def get_duration() -> OfferDuration:
        return OfferDuration.CLAIMABLE

    async def scrape(self) -> list[Offer]:
        offers = await self.read_offers_from_page()
        categorized_offers = self.categorize_offers(offers)
        filtered = list(
            filter(lambda offer: offer.category != Category.DEMO, categorized_offers)
        )
        return filtered

    async def read_offers_from_page(self) -> list[Offer]:
        async with get_new_page(self.context) as page:
            await page.goto(OFFER_URL)
            raw_offers: list[RawOffer] = []

            elements = page.locator("div.short_info")

            try:
                no_res = await elements.count()

                for i in range(no_res):
                    element = elements.nth(i)

                    raw_offers.append(await GoogleGamesScraper.read_raw_offer(element))

            except Error as e:
                logger.error(f"Page could not be read: {e}")
                return []

        normalized_offers = GoogleGamesScraper.normalize_offers(raw_offers)

        return normalized_offers

    @staticmethod
    async def read_raw_offer(element: Locator) -> RawOffer:
        # Scroll into view for images to load
        await element.scroll_into_view_if_needed()
        title = await element.locator("a.nwel").text_content()
        url = await element.locator("a.nwel").get_attribute("href")
        if url is not None:
            url = BASE_URL + url
        img_url = await element.locator("span.pic_div").get_attribute("style")
        if img_url is not None:
            img_url = img_url.removeprefix('background-image: url("').removesuffix(
                '");'
            )

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
            if not raw_offer.title:
                logger.error(f"Error with offer, has no title: {raw_offer}")
                continue

            rawtext = f"<title>{raw_offer.title}</title>"

            # Title
            title = raw_offer.title

            nearest_url = raw_offer.url if raw_offer.url else OFFER_URL
            offer = Offer(
                source=GoogleGamesScraper.get_source(),
                duration=GoogleGamesScraper.get_duration(),
                type=GoogleGamesScraper.get_type(),
                title=title,
                probable_game_name=title,
                seen_last=datetime.now(timezone.utc),
                rawtext=rawtext,
                url=nearest_url,
                img_url=raw_offer.img_url,
            )

            normalized_offers.append(offer)

        return normalized_offers

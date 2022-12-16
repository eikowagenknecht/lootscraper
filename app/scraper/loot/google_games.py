import logging
from datetime import datetime, timezone

from playwright.async_api import Locator, Page

from app.common import OfferDuration, OfferType, Source
from app.scraper.loot.scraper import OfferHandler, RawOffer, Scraper
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

    def get_offers_url(self) -> str:
        return OFFER_URL

    def get_page_ready_selector(self) -> str:
        return "div.short_info"

    def get_offer_handlers(self, page: Page) -> list[OfferHandler]:
        return [
            OfferHandler(
                page.locator(
                    "div.short_info",
                ),
                self.read_raw_offer,
            )
        ]

    async def page_loaded_hook(self, page: Page) -> None:
        await Scraper.scroll_page_to_bottom(page)

    async def read_raw_offer(self, element: Locator) -> RawOffer:
        # Scroll into view for images to load
        await element.scroll_into_view_if_needed()

        title = await element.locator("a.nwel").text_content()
        if title is None:
            raise ValueError("Couldn't find title.")

        url = await element.locator("a.nwel").get_attribute("href")
        if url is None:
            raise ValueError(f"Couldn't find url for {title}.")
        url = BASE_URL + url

        img_url = await element.locator("span.pic_div").get_attribute("style")
        if img_url is None:
            raise ValueError(f"Couldn't find image for {title}.")
        img_url = img_url.removeprefix('background-image: url("').removesuffix('");')

        return RawOffer(
            title=title,
            url=url,
            img_url=img_url,
        )

    def normalize_offers(self, raw_offers: list[RawOffer]) -> list[Offer]:
        normalized_offers: list[Offer] = []

        for raw_offer in raw_offers:
            rawtext = f"<title>{raw_offer.title}</title>"
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

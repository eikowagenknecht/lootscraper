import logging
import urllib.parse
from dataclasses import dataclass
from datetime import datetime, timezone

from playwright.async_api import Locator, Page

from app.common import OfferDuration, OfferType, Source
from app.scraper.loot.scraper import OfferHandler, RawOffer, Scraper
from app.sqlalchemy import Offer

logger = logging.getLogger(__name__)

BASE_URL = "https://humblebundle.com"
SEARCH_URL = BASE_URL + "/store/search"
SEARCH_URL_PARAMS = {
    "sort": "discount",
    "filter": "onsale",
}


@dataclass(kw_only=True)
class HumbleRawOffer(RawOffer):
    # This is unused for now!
    # TODO: Check details page for valid_to (makes it easier to filter out nonsense entries that are valid "forever")
    valid_to: str | None = None


class HumbleGamesScraper(Scraper):
    @staticmethod
    def get_source() -> Source:
        return Source.HUMBLE

    @staticmethod
    def get_type() -> OfferType:
        return OfferType.GAME

    @staticmethod
    def get_duration() -> OfferDuration:
        return OfferDuration.CLAIMABLE

    def get_offers_url(self) -> str:
        return f"{SEARCH_URL}?{urllib.parse.urlencode(SEARCH_URL_PARAMS)}"

    def get_page_ready_selector(self) -> str:
        return "li div.discount-amount"

    def get_offer_handlers(self, page: Page) -> list[OfferHandler]:
        return [
            OfferHandler(
                page.locator(
                    "li", has=page.locator("div.discount-amount", has_text="100")
                ),
                self.read_raw_offer,
                self.normalize_offer,
            )
        ]

    async def read_raw_offer(self, element: Locator) -> HumbleRawOffer:
        title = await element.locator("span.entity-title").text_content()
        if title is None:
            raise ValueError("Couldn't find title.")

        url = await element.locator("a").get_attribute("href")
        if url is None:
            raise ValueError(f"Couldn't find url for {title}.")
        if not url.startswith("http"):
            url = BASE_URL + url

        img_url = await element.locator("img.entity-image").get_attribute("src")
        if img_url is None:
            raise ValueError(f"Couldn't find image for {title}.")

        return HumbleRawOffer(
            title=title,
            url=url,
            img_url=img_url,
        )

    def normalize_offer(self, raw_offer: RawOffer) -> Offer:
        if not isinstance(raw_offer, HumbleRawOffer):
            raise ValueError("Wrong type of raw offer.")

        rawtext = f"<title>{raw_offer.title}</title>"
        title = raw_offer.title

        return Offer(
            source=HumbleGamesScraper.get_source(),
            duration=HumbleGamesScraper.get_duration(),
            type=HumbleGamesScraper.get_type(),
            title=title,
            probable_game_name=title,
            seen_last=datetime.now(timezone.utc),
            rawtext=rawtext,
            url=raw_offer.url,
            img_url=raw_offer.img_url,
        )

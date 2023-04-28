import logging
from dataclasses import dataclass
from datetime import datetime, timezone

from playwright.async_api import Locator, Page

from lootscraper.common import OfferDuration, OfferType, Source
from lootscraper.database import Offer
from lootscraper.scraper.loot.scraper import OfferHandler, RawOffer, Scraper

logger = logging.getLogger(__name__)

BASE_URL = "https://store.ubi.com"
OFFER_URL = BASE_URL + "/us/"


@dataclass(kw_only=True)
class UbisoftRawOffer(RawOffer):
    valid_to: str


class UbisoftGamesScraper(Scraper):
    @staticmethod
    def get_source() -> Source:
        return Source.UBISOFT

    @staticmethod
    def get_type() -> OfferType:
        return OfferType.GAME

    @staticmethod
    def get_duration() -> OfferDuration:
        return OfferDuration.CLAIMABLE

    def offers_expected(self) -> bool:
        return False

    def get_offers_url(self) -> str:
        return OFFER_URL

    def get_page_ready_selector(self) -> str:
        return ".wrapper"

    def get_offer_handlers(self, page: Page) -> list[OfferHandler]:
        return [
            OfferHandler(
                page.locator(".c-focus-banner__wrapper"),
                self.read_raw_offer,
                self.normalize_offer,
            ),
        ]

    async def read_raw_offer(self, element: Locator) -> RawOffer | None:
        # Scroll element into view to load img url
        await element.scroll_into_view_if_needed()

        title = await element.locator(".c-focus-banner__title").text_content()
        if title is None:
            raise ValueError("Couldn't find title.")

        if "free" not in title.lower():
            return None

        # Format: January 23, 2023 at 3PM UTC
        valid_to = await element.locator(".c-focus-banner__legal-line").inner_text()

        if valid_to is None:
            raise ValueError(f"Couldn't find valid to for {title}.")

        url = await element.locator("a").get_attribute("href")
        if url is None:
            raise ValueError(f"Couldn't find url for {title}.")
        if not url.startswith("http"):
            url = BASE_URL + url

        img_url = await element.locator("img").get_attribute("src")
        if img_url is None:
            raise ValueError(f"Couldn't find image for {title}.")
        if not img_url.startswith("http"):
            img_url = BASE_URL + img_url

        return UbisoftRawOffer(
            title=title,
            valid_to=valid_to,
            url=url,
            img_url=img_url,
        )

    def normalize_offer(self, raw_offer: RawOffer) -> Offer:
        if not isinstance(raw_offer, UbisoftRawOffer):
            raise TypeError("Wrong type of raw offer.")

        rawtext = {
            "title": raw_offer.title,
            "enddate": raw_offer.valid_to,
        }

        title = raw_offer.title.removeprefix("Get ").removesuffix(" for FREE!")
        valid_to = raw_offer.valid_to.removeprefix("Offer valid until ").removesuffix(
            " UTC.",
        )

        utc_valid_to = None
        if valid_to:
            utc_valid_to = datetime.strptime(valid_to, "%B %d, %Y at %I%p").replace(
                tzinfo=timezone.utc,
            )

        return Offer(
            source=UbisoftGamesScraper.get_source(),
            duration=UbisoftGamesScraper.get_duration(),
            type=UbisoftGamesScraper.get_type(),
            title=title,
            probable_game_name=title,
            seen_last=datetime.now(timezone.utc),
            valid_to=utc_valid_to,
            rawtext=rawtext,
            url=raw_offer.url,
            img_url=raw_offer.img_url,
        )

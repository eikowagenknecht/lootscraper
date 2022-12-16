import logging
from dataclasses import dataclass
from datetime import datetime, timezone

from playwright.async_api import Locator, Page

from app.common import OfferDuration, OfferType, Source
from app.scraper.loot.scraper import OfferHandler, RawOffer, Scraper
from app.sqlalchemy import Offer

logger = logging.getLogger(__name__)

BASE_URL = "https://store.epicgames.com"
OFFER_URL = BASE_URL + "/en-US/"


@dataclass(kw_only=True)
class EpicRawOffer(RawOffer):
    valid_to: str


class EpicGamesScraper(Scraper):
    @staticmethod
    def get_source() -> Source:
        return Source.EPIC

    @staticmethod
    def get_type() -> OfferType:
        return OfferType.GAME

    @staticmethod
    def get_duration() -> OfferDuration:
        return OfferDuration.CLAIMABLE

    def get_offers_url(self) -> str:
        return OFFER_URL

    def get_page_ready_selector(self) -> str:
        return "h2:has-text('Free Games')"

    def get_offer_handlers(self, page: Page) -> list[OfferHandler]:
        return [
            OfferHandler(
                page.locator('//span[text()="Free Now"]//ancestor::a'),
                self.read_raw_offer,
            ),
        ]

    async def read_raw_offer(self, element: Locator) -> RawOffer:
        # Scroll element into view to load img url
        await element.scroll_into_view_if_needed()

        title = await element.locator(
            '[data-testid="offer-title-info-title"] div'
        ).text_content()
        if title is None:
            raise ValueError("Couldn't find title.")

        # For current offers, the date is included twice but only means the enddate
        # format 2022-02-24T16:00:00.000Z
        valid_to = (
            await element.locator('[data-testid="offer-title-info-subtitle"] time')
            .nth(1)
            .get_attribute("datetime")
        )
        if valid_to is None:
            raise ValueError(f"Couldn't find valid to for {title}.")

        url = await element.get_attribute("href")
        if url is None:
            raise ValueError(f"Couldn't find url for {title}.")
        url = BASE_URL + url

        img_url = await element.locator("img").get_attribute("src")
        if img_url is None:
            raise ValueError(f"Couldn't find image for {title}.")

        return EpicRawOffer(
            title=title,
            valid_to=valid_to,
            url=url,
            img_url=img_url,
        )

    def normalize_offers(self, raw_offers: list[EpicRawOffer]) -> list[Offer]:  # type: ignore
        normalized_offers: list[Offer] = []

        for raw_offer in raw_offers:
            rawtext = f"<title>{raw_offer.title}</title>"
            rawtext += f"<enddate>{raw_offer.valid_to}</enddate>"
            title = raw_offer.title

            utc_valid_to = None
            if raw_offer.valid_to:
                try:
                    utc_valid_to = datetime.strptime(
                        raw_offer.valid_to,
                        "%Y-%m-%dT%H:%M:%S.000Z",
                    ).replace(tzinfo=timezone.utc)
                except ValueError:
                    # TODO: Error handling, put main loop into Scraper and handle normalization here for each entry
                    utc_valid_to = None

            nearest_url = raw_offer.url if raw_offer.url else OFFER_URL
            offer = Offer(
                source=EpicGamesScraper.get_source(),
                duration=EpicGamesScraper.get_duration(),
                type=EpicGamesScraper.get_type(),
                title=title,
                probable_game_name=title,
                seen_last=datetime.now(timezone.utc),
                valid_to=utc_valid_to,
                rawtext=rawtext,
                url=nearest_url,
                img_url=raw_offer.img_url,
            )

            normalized_offers.append(offer)

        return normalized_offers

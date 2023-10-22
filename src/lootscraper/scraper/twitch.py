from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import TYPE_CHECKING

from lootscraper.common import OfferDuration, OfferType, Source
from lootscraper.database import Offer
from lootscraper.scraper.scraper_base import OfferHandler, RawOffer, Scraper

if TYPE_CHECKING:
    from playwright.async_api import Locator, Page

logger = logging.getLogger(__name__)

BASE_URL = "https://www.twitch.tv"
OFFER_URL = BASE_URL + "/drops/campaigns"


@dataclass(kw_only=True)
class TwitchRawOffer(RawOffer):
    # valid_to: str
    pass


class TwitchDropsScraper(Scraper):
    @staticmethod
    def get_source() -> Source:
        return Source.TWITCH

    @staticmethod
    def get_type() -> OfferType:
        return OfferType.LOOT

    @staticmethod
    def get_duration() -> OfferDuration:
        return OfferDuration.CLAIMABLE

    def offers_expected(self) -> bool:
        return True

    def get_offers_url(self) -> str:
        return OFFER_URL

    def get_page_ready_selector(self) -> str:
        return "h4:has-text('Open Drop Campaigns')"

    def get_offer_handlers(self, page: Page) -> list[OfferHandler]:
        offers_xpath = (
            '//h4[text()="Open Drop Campaigns"]'
            "/.."
            "/.."
            "/.."
            "/following-sibling::div[1]"
            '//div[contains(@class, "ScAccordionHeaderContents")]'
        )
        return [
            OfferHandler(
                page.locator(offers_xpath),
                self.read_raw_offer,
                self.normalize_offer,
            ),
        ]

    async def read_raw_offer(self, element: Locator) -> RawOffer:
        # Scroll element into view to load img url
        await element.scroll_into_view_if_needed()

        title = await element.locator(
            "h3",
        ).text_content()
        if title is None:
            raise ValueError("Couldn't find title.")

        # # For current offers, the date is included twice but only means the enddate
        # # format 2022-02-24T16:00:00.000Z
        # valid_to = (
        #     await element.locator('[data-testid="offer-title-info-subtitle"] time')
        #     .nth(1)
        #     .get_attribute("datetime")
        # )
        # if valid_to is None:
        #     raise ValueError(f"Couldn't find valid to for {title}.")

        # url = await element.get_attribute("href")
        # if url is None:
        #     raise ValueError(f"Couldn't find url for {title}.")
        # if not url.startswith("http"):
        #     url = BASE_URL + url

        # img_url = await element.locator("img").get_attribute("src")
        # if img_url is None:
        #     raise ValueError(f"Couldn't find image for {title}.")

        return TwitchRawOffer(
            title=title,
            # valid_to=valid_to,
            # url=url,
            # img_url=img_url,
        )

    def normalize_offer(self, raw_offer: RawOffer) -> Offer:
        if not isinstance(raw_offer, TwitchRawOffer):
            raise TypeError("Wrong type of raw offer.")

        return None
        # rawtext = {
        #     "title": raw_offer.title,
        #     "enddate": raw_offer.valid_to,
        # }

        # utc_valid_to = None
        # if raw_offer.valid_to:
        #     try:
        #         utc_valid_to = datetime.strptime(
        #             raw_offer.valid_to,
        #             "%Y-%m-%dT%H:%M:%S.000Z",
        #         ).replace(tzinfo=timezone.utc)
        #     except ValueError:
        #         # TODO: Error handling, put main loop into Scraper and handle
        #         # normalization here for each entry
        #         utc_valid_to = None

        # return Offer(
        #     source=EpicGamesScraper.get_source(),
        #     duration=EpicGamesScraper.get_duration(),
        #     type=EpicGamesScraper.get_type(),
        #     title=raw_offer.title,
        #     probable_game_name=raw_offer.title,
        #     seen_last=datetime.now(timezone.utc),
        #     valid_to=utc_valid_to,
        #     rawtext=rawtext,
        #     url=raw_offer.url,
        #     img_url=raw_offer.img_url,
        # )

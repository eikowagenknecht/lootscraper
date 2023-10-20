from __future__ import annotations

import logging
from datetime import date, datetime, time, timedelta, timezone
from typing import TYPE_CHECKING

from lootscraper.common import OfferType
from lootscraper.database import Offer
from lootscraper.scraper.info.utils import clean_game_title
from lootscraper.scraper.loot.amazon_base import AmazonBaseScraper, AmazonRawOffer
from lootscraper.scraper.loot.scraper import OfferHandler, RawOffer, Scraper

if TYPE_CHECKING:
    from playwright.async_api import Locator, Page

logger = logging.getLogger(__name__)


class AmazonGamesScraper(AmazonBaseScraper):
    @staticmethod
    def get_type() -> OfferType:
        return OfferType.GAME

    def get_offer_handlers(self, page: Page) -> list[OfferHandler]:
        return [
            OfferHandler(
                page.locator(
                    '[data-a-target="offer-list-FGWP_FULL"] '
                    '[data-a-target="item-card"]',
                ),
                self.read_raw_offer,
                self.normalize_offer,
            ),
        ]

    async def page_loaded_hook(self, page: Page) -> None:
        await Scraper.scroll_element_to_bottom(page, "root")

    async def read_raw_offer(
        self,
        element: Locator,
    ) -> AmazonRawOffer:
        return await self.read_base_raw_offer(element)

    def normalize_offer(self, raw_offer: RawOffer) -> Offer:
        if not isinstance(raw_offer, AmazonRawOffer):
            raise TypeError("Wrong type of raw offer.")

        rawtext = {
            "title": raw_offer.title,
        }

        probable_game_name = clean_game_title(raw_offer.title)

        # Date
        # This is a bit more complicated as only the relative end is
        # displayed ("Ends in ..."). So we have to guess the real date:
        #
        # The *year* is guessed assuming that old offers are not shown any
        # more. "Old" means older than yesterday to avoid time zone problems.
        #
        # The *day* is more complicated. The seen values are:
        # "Ends in x days", "Ends tomorrow", "Ends today", no time given.
        # I've been watching this for some days now for multiple offers and
        # it is quite inconsistent. The x "Ends in x days" mostly counts
        # down by 1 at about 17:00 UTC. But sometimes (for a single offer!)
        # it can also be about an hour later, suggesting that there is some
        # caching in place on Amazon's side. For other offers, it is another
        # time of day entirely. The offers also don't seem to be valid for
        # a timespan that is a multiple of 24 hours, making it even harder
        # to guess.
        #
        # The most accurate approach I can think of would be to track when
        # the "Ends in x days" first counts down by one and then use the
        # new x times 24 hours to calculate the end date. Unfortunately that
        # means having to wait for up to 24 hours after the offer shows up,
        # so I think the more accurate end time is not really worth the delay.
        #
        # So for now to have something, we will assume that it means
        # "the end of the day in UTC". This is probably up to 1 day wrong,
        # but at least we have a rough indication of when the offer ends.
        end_date = None
        if raw_offer.valid_to:
            logger.debug(f"Found date: {raw_offer.valid_to} for {raw_offer.title}")
            try:
                raw_date = raw_offer.valid_to.removeprefix("Ends ").lower()
                if raw_date == "today":
                    parsed_date = datetime.now(tz=timezone.utc).replace(
                        hour=0,
                        minute=0,
                        second=0,
                    )
                elif raw_date == "tomorrow":
                    parsed_date = datetime.now(tz=timezone.utc).replace(
                        hour=0,
                        minute=0,
                        second=0,
                    ) + timedelta(days=1)
                else:
                    parsed_date = datetime.now(tz=timezone.utc).replace(
                        hour=0,
                        minute=0,
                        second=0,
                    ) + timedelta(days=int(raw_date.split(" ")[1]))

                # Correct the year
                guessed_end_date = date(
                    datetime.now(tz=timezone.utc).date().year,
                    parsed_date.month,
                    parsed_date.day,
                )
                yesterday = datetime.now(tz=timezone.utc).date() - timedelta(days=1)
                if guessed_end_date < yesterday:
                    guessed_end_date = guessed_end_date.replace(
                        year=guessed_end_date.year + 1,
                    )

                # Add 1 day because of the notation
                # ("Ends today" means "Ends at 00:00:00 the next day")
                end_date = datetime.combine(
                    guessed_end_date + timedelta(days=1),
                    time.min,
                    tzinfo=timezone.utc,
                )
            except (ValueError, IndexError):
                logger.warning(f"Date parsing failed for {raw_offer.title}")

        return Offer(
            source=AmazonGamesScraper.get_source(),
            duration=AmazonGamesScraper.get_duration(),
            type=AmazonGamesScraper.get_type(),
            title=raw_offer.title,
            probable_game_name=probable_game_name,
            seen_last=datetime.now(timezone.utc),
            valid_to=end_date,
            rawtext=rawtext,
            url=raw_offer.url,
            img_url=raw_offer.img_url,
        )

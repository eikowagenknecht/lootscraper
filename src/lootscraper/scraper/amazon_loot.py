from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING

from lootscraper.common import OfferType
from lootscraper.database import Offer
from lootscraper.scraper.amazon_base import AmazonBaseScraper, AmazonRawOffer
from lootscraper.scraper.scraper_base import OfferHandler, RawOffer, Scraper

if TYPE_CHECKING:
    from playwright.async_api import Locator, Page

logger = logging.getLogger(__name__)


@dataclass
class AmazonLootRawOffer(AmazonRawOffer):
    game_title: str | None = None


class AmazonLootScraper(AmazonBaseScraper):
    @staticmethod
    def get_type() -> OfferType:
        return OfferType.LOOT

    def get_offer_handlers(self, page: Page) -> list[OfferHandler]:
        return [
            OfferHandler(
                page.locator(
                    '[data-a-target="offer-list-IN_GAME_LOOT"] '
                    " .item-card__action > a:first-child",
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
    ) -> AmazonLootRawOffer:
        base_raw_offer = await self.read_base_raw_offer(element)

        game_title = (
            await element.locator(".item-card-details__body p").nth(0).text_content()
        )
        if game_title is None:
            raise ValueError("Couldn't find game title.")

        return AmazonLootRawOffer(
            title=base_raw_offer.title,
            valid_to=base_raw_offer.valid_to,
            url=base_raw_offer.url,
            img_url=base_raw_offer.img_url,
            game_title=game_title,
        )

    def normalize_offer(self, raw_offer: RawOffer) -> Offer:
        if not isinstance(raw_offer, AmazonLootRawOffer):
            raise TypeError("Wrong type of raw offer.")

        rawtext = {
            "title": raw_offer.title,
            "gametitle": raw_offer.game_title,
        }

        if raw_offer.game_title is None:
            raise ValueError("No game title found.")

        title = f"{raw_offer.game_title}: {raw_offer.title}"

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
                raw_date = raw_offer.valid_to.removeprefix("Ends ")
                if raw_date.lower() == "today":
                    parsed_date = datetime.now(tz=UTC).replace(
                        hour=0,
                        minute=0,
                        second=0,
                    )
                elif raw_date.lower() == "tomorrow":
                    parsed_date = datetime.now(tz=UTC).replace(
                        hour=0,
                        minute=0,
                        second=0,
                    ) + timedelta(days=1)
                else:
                    parsed_date = datetime.strptime(raw_date, "%b %d, %Y").replace(
                        tzinfo=UTC,
                        hour=0,
                        minute=0,
                        second=0,
                    )

                end_date = parsed_date
            except (ValueError, IndexError):
                logger.warning(f"Date parsing failed for {raw_offer.title}")

        return Offer(
            source=AmazonLootScraper.get_source(),
            duration=AmazonLootScraper.get_duration(),
            type=AmazonLootScraper.get_type(),
            title=title,
            probable_game_name=raw_offer.game_title,
            seen_last=datetime.now(UTC),
            valid_to=end_date,
            rawtext=rawtext,
            url=raw_offer.url,
            img_url=raw_offer.img_url,
        )

import logging
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone

from playwright.async_api import Error

from app.common import OfferDuration, OfferType, Source
from app.pagedriver import get_new_page
from app.scraper.info.utils import clean_game_title
from app.scraper.loot.scraper import RawOffer, Scraper
from app.sqlalchemy import Offer

logger = logging.getLogger(__name__)

ROOT_URL = "https://gaming.amazon.com/home"


@dataclass
class AmazonRawOffer(RawOffer):
    valid_to: str | None = None


class AmazonGamesScraper(Scraper):
    @staticmethod
    def get_source() -> Source:
        return Source.AMAZON

    @staticmethod
    def get_type() -> OfferType:
        return OfferType.GAME

    @staticmethod
    def get_duration() -> OfferDuration:
        return OfferDuration.CLAIMABLE

    async def read_offers_from_page(self) -> list[Offer]:
        raw_offers: list[AmazonRawOffer] = []

        async with get_new_page(self.context) as page:
            await page.goto(ROOT_URL)
            try:
                await page.wait_for_selector(".offer-list__content")
                await AmazonGamesScraper.scroll_element_to_bottom(page, "root")
            except Error as e:
                logger.error(f"Page could not be read: {e}")
                return []

            elements = page.locator(
                '[data-a-target="offer-list-FGWP_FULL"] .item-card__action'
            )

            try:
                no_res = await elements.count()
            except Error as e:
                logger.error(f"Root element not found, could not scrape: {e}")
                return []

            for i in range(no_res):
                element = elements.nth(i)

                try:
                    title = await element.locator(
                        ".item-card-details__body__primary h3"
                    ).text_content()
                    if not title:
                        # Skip offers with empty titles
                        continue
                except Error:
                    # Skip offers without titles
                    continue

                # Skip duplicates (everything is contained twice on the page for weird JS reasons)
                if any(x.title == title for x in raw_offers):
                    continue

                raw_offer = AmazonRawOffer(title)

                try:
                    raw_offer.valid_to = await element.locator(
                        ".item-card__availability-date p"
                    ).text_content(timeout=500)
                except Error:
                    # Nothing to do here, string stays empty
                    pass

                try:
                    raw_offer.url = await element.locator(
                        '[data-a-target="learn-more-card"]'
                    ).get_attribute("href", timeout=500)
                except Error:
                    # Nothing to do here, string stays empty
                    pass

                try:
                    raw_offer.img_url = await element.locator(
                        '[data-a-target="card-image"] img'
                    ).get_attribute("src", timeout=500)
                except Error:
                    # Nothing to do here, string stays empty
                    pass

                raw_offers.append(raw_offer)

        normalized_offers = AmazonGamesScraper.normalize_offers(raw_offers)

        return normalized_offers

    @staticmethod
    def normalize_offers(raw_offers: list[AmazonRawOffer]) -> list[Offer]:
        normalized_offers: list[Offer] = []

        for raw_offer in raw_offers:
            # Raw text
            if not raw_offer.title:
                logger.error(f"Error with offer, has no title: {raw_offer}")
                continue

            rawtext = f"<title>{raw_offer.title}</title>"

            # Title
            probable_game_name: str | None = None
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
                        parsed_date = datetime.now().replace(
                            tzinfo=timezone.utc, hour=0, minute=0, second=0
                        )
                    elif raw_date == "tomorrow":
                        parsed_date = datetime.now().replace(
                            tzinfo=timezone.utc, hour=0, minute=0, second=0
                        ) + timedelta(days=1)
                    else:
                        parsed_date = datetime.now().replace(
                            tzinfo=timezone.utc, hour=0, minute=0, second=0
                        ) + timedelta(days=int(raw_date.split(" ")[1]))

                    # Correct the year
                    guessed_end_date = date(
                        date.today().year, parsed_date.month, parsed_date.day
                    )
                    yesterday = date.today() - timedelta(days=1)
                    if guessed_end_date < yesterday:
                        guessed_end_date = guessed_end_date.replace(
                            year=guessed_end_date.year + 1
                        )

                    # Add 1 day because of the notation
                    # ("Ends today" means "Ends at 00:00:00 the next day")
                    end_date = datetime.combine(
                        guessed_end_date + timedelta(days=1),
                        time.min,
                    ).replace(tzinfo=timezone.utc)
                except (ValueError, IndexError):
                    logger.warning(f"Date parsing failed for {raw_offer.title}")

            nearest_url = raw_offer.url if raw_offer.url else ROOT_URL
            offer = Offer(
                source=AmazonGamesScraper.get_source(),
                duration=AmazonGamesScraper.get_duration(),
                type=AmazonGamesScraper.get_type(),
                title=raw_offer.title,
                probable_game_name=probable_game_name,
                seen_last=datetime.now(timezone.utc),
                valid_to=end_date,
                rawtext=rawtext,
                url=nearest_url,
                img_url=raw_offer.img_url,
            )

            normalized_offers.append(offer)

        return normalized_offers

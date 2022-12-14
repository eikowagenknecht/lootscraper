import logging
from dataclasses import dataclass
from datetime import datetime, timezone

from playwright.async_api import Error, Locator

from app.common import OfferDuration, OfferType, Source
from app.configparser import Config
from app.pagedriver import get_new_page
from app.scraper.loot.scraper import RawOffer, Scraper
from app.sqlalchemy import Offer

logger = logging.getLogger(__name__)

BASE_URL = "https://store.epicgames.com"
OFFER_URL = BASE_URL + "/en-US/"


@dataclass
class EpicRawOffer(RawOffer):
    valid_from: str | None = None
    valid_to: str | None = None


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

    async def read_offers_from_page(self) -> list[Offer]:
        raw_offers: list[EpicRawOffer] = []

        async with get_new_page(self.context) as page:
            await page.goto(OFFER_URL)

            try:
                await page.wait_for_selector("h2:has-text('Free Games')")
            except Error:
                filename = (
                    Config.data_path()
                    / f'screenshot_error_{datetime.now().isoformat().replace(".", "_").replace(":", "_")}.png'
                )
                logger.error(
                    f"Error loading the page. Saving Screenshot to {filename}."
                )
                await page.screenshot(path=str(filename.resolve()))
                return []

            elements = page.locator('//span[text()="Free Now"]//ancestor::a')

            try:
                no_res = await elements.count()
                for i in range(no_res):
                    element = elements.nth(i)
                    try:
                        raw_offer = await EpicGamesScraper.read_raw_offer(element)
                        raw_offers.append(raw_offer)
                    except Error as e:
                        logger.error(f"Error loading offer: {e}")

            except Error as e:
                logger.error(f"No current offers found: {e}")
                return []

        normalized_offers = EpicGamesScraper.normalize_offers(raw_offers)

        return normalized_offers

    @staticmethod
    async def read_raw_offer(element: Locator) -> EpicRawOffer:
        # Scroll element into view to load img url
        await element.scroll_into_view_if_needed()

        title_str = await element.locator(
            '[data-testid="offer-title-info-title"] div'
        ).text_content()
        valid_from_str = (
            await element.locator('[data-testid="offer-title-info-subtitle"] time')
            .nth(0)
            .get_attribute("datetime")
        )  # format 2022-02-24T16:00:00.000Z
        valid_to_str = (
            await element.locator('[data-testid="offer-title-info-subtitle"] time')
            .nth(1)
            .get_attribute("datetime")
        )
        url = await element.get_attribute("href")
        if url is not None:
            url = BASE_URL + url
        img_url = await element.locator("img").get_attribute("src")

        # For current offers, the date is included twice but only means the enddate
        if valid_from_str == valid_to_str:
            valid_from_str = None

        return EpicRawOffer(
            title=title_str,
            valid_from=valid_from_str,
            valid_to=valid_to_str,
            url=url,
            img_url=img_url,
        )

    @staticmethod
    def normalize_offers(raw_offers: list[EpicRawOffer]) -> list[Offer]:
        normalized_offers: list[Offer] = []

        for raw_offer in raw_offers:
            # Raw text
            if not raw_offer.title:
                logger.error(f"Error with offer, has no title: {raw_offer}")
                continue

            rawtext = f"<title>{raw_offer.title}</title>"

            if raw_offer.valid_from:
                rawtext += f"<startdate>{raw_offer.valid_from}</startdate>"

            if raw_offer.valid_to:
                rawtext += f"<enddate>{raw_offer.valid_to}</enddate>"

            # Title
            title = raw_offer.title

            # Valid from
            utc_valid_from = None
            if raw_offer.valid_from:
                try:
                    utc_valid_from = datetime.strptime(
                        raw_offer.valid_from,
                        "%Y-%m-%dT%H:%M:%S.000Z",
                    ).replace(tzinfo=timezone.utc)
                except ValueError:
                    utc_valid_from = None

            # Valid to
            utc_valid_to = None
            if raw_offer.valid_to:
                try:
                    utc_valid_to = datetime.strptime(
                        raw_offer.valid_to,
                        "%Y-%m-%dT%H:%M:%S.000Z",
                    ).replace(tzinfo=timezone.utc)
                except ValueError:
                    utc_valid_to = None

            nearest_url = raw_offer.url if raw_offer.url else OFFER_URL
            offer = Offer(
                source=EpicGamesScraper.get_source(),
                duration=EpicGamesScraper.get_duration(),
                type=EpicGamesScraper.get_type(),
                title=title,
                probable_game_name=title,
                seen_last=datetime.now(timezone.utc),
                valid_from=utc_valid_from,
                valid_to=utc_valid_to,
                rawtext=rawtext,
                url=nearest_url,
                img_url=raw_offer.img_url,
            )

            normalized_offers.append(offer)

        return normalized_offers

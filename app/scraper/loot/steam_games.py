import logging
import urllib.parse
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from playwright.async_api import Error, Locator

from app.common import OfferDuration, OfferType, Source
from app.pagedriver import get_new_page
from app.scraper.info.steam import skip_age_verification
from app.scraper.info.utils import clean_game_title
from app.scraper.loot.scraper import RawOffer, Scraper
from app.sqlalchemy import Offer

logger = logging.getLogger(__name__)

BASE_URL = "https://store.steampowered.com"
SEARCH_URL = BASE_URL + "/search/"
SEARCH_URL_PARAMS = {
    "maxprice": "free",
    "category1": 998,  # Games
    "specials": 1,
}

DETAILS_URL = BASE_URL + "/app/"


@dataclass
class SteamRawOffer(RawOffer):
    appid: int | None = None
    text: str | None = None


class SteamGamesScraper(Scraper):
    @staticmethod
    def get_source() -> Source:
        return Source.STEAM

    @staticmethod
    def get_type() -> OfferType:
        return OfferType.GAME

    @staticmethod
    def get_duration() -> OfferDuration:
        return OfferDuration.CLAIMABLE

    async def read_offers_from_page(self) -> list[Offer]:
        url = f"{SEARCH_URL}?{urllib.parse.urlencode(SEARCH_URL_PARAMS)}"
        raw_offers: list[SteamRawOffer] = []

        async with get_new_page(self.context) as page:
            await page.goto(url)

            try:
                await page.wait_for_selector("#search_results")
            except Error as e:
                logger.error(f"Couldn't load offers: {e}")
                return []

            elements = page.locator("#search_results a")

            try:
                no_res = await elements.count()
            except Error as e:
                logger.error(f"Couldn't load search results: {e}")
                return []

            for i in range(no_res):
                try:
                    element = elements.nth(i)
                    raw_offers.append(await self.read_raw_offer(element))
                except Error as e:
                    logger.error(f"Couldn't load offer {i}: {e}")

        normalized_offers = SteamGamesScraper.normalize_offers(raw_offers)

        return normalized_offers

    async def read_raw_offer(self, element: Locator) -> SteamRawOffer:
        title = await element.locator(".title").text_content()
        if title is None:
            raise ValueError("Couldn't find title.")
        appid = await element.get_attribute("data-ds-appid")
        if appid is None:
            raise ValueError(f"Couldn't find appid for {title}")
        url = DETAILS_URL + str(appid)

        async with get_new_page(self.context) as page:
            await page.goto(url)

            await skip_age_verification(page)
            await page.wait_for_selector(".game_area_purchase")

            text = await page.locator(
                ".game_purchase_discount_countdown"
            ).text_content()

        return SteamRawOffer(
            appid=int(appid),
            title=title,
            url=url,
            text=text,
        )

    @staticmethod
    def normalize_offers(raw_offers: list[SteamRawOffer]) -> list[Offer]:
        normalized_offers: list[Offer] = []

        now = datetime.now(timezone.utc)

        for raw_offer in raw_offers:
            # Raw text
            rawtext = f"<title>{raw_offer.title}</title>"

            if raw_offer.appid:
                rawtext += f"<appid>{raw_offer.appid}</appid>"

            if raw_offer.text:
                rawtext += f"<text>{raw_offer.text}</text>"

            # Valid from date
            valid_to: datetime | None = None
            if raw_offer.text:
                maybe_date = raw_offer.text.removeprefix(
                    "Free to keep when you get it before "
                ).removesuffix(". Some limitations apply. (?)")
                try:
                    valid_to = (
                        datetime.strptime(maybe_date, "%d %b @ %I:%M%p")
                        .replace(tzinfo=timezone.utc)
                        .replace(year=now.year)
                    )
                    # Date has to be in the future, adjust the year accordingly
                    yesterday = now - timedelta(days=1)
                    if valid_to < yesterday:
                        valid_to = valid_to.replace(year=valid_to.year + 1)
                except ValueError:
                    logger.warning(f"Couldn't parse date {maybe_date}")

            # Probable game name
            if not raw_offer.title:
                probable_game_name = None
            else:
                probable_game_name = clean_game_title(raw_offer.title)

            nearest_url = raw_offer.url if raw_offer.url else SEARCH_URL
            offer = Offer(
                source=SteamGamesScraper.get_source(),
                duration=SteamGamesScraper.get_duration(),
                type=SteamGamesScraper.get_type(),
                title=raw_offer.title,
                probable_game_name=probable_game_name,
                seen_last=now,
                valid_to=valid_to,
                rawtext=rawtext,
                url=nearest_url,
            )

            normalized_offers.append(offer)

        return normalized_offers

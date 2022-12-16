import logging
import urllib.parse
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from playwright.async_api import Locator, Page

from app.common import OfferDuration, Source
from app.pagedriver import get_new_page
from app.scraper.info.steam import skip_age_verification
from app.scraper.info.utils import clean_title
from app.scraper.loot.scraper import OfferHandler, RawOffer, Scraper
from app.sqlalchemy import Offer

logger = logging.getLogger(__name__)

BASE_URL = "https://store.steampowered.com"
SEARCH_URL = BASE_URL + "/search/"
DETAILS_URL = BASE_URL + "/app/"


@dataclass(kw_only=True)
class SteamRawOffer(RawOffer):
    appid: int
    text: str


class SteamBaseScraper(Scraper):  # pylint: disable=W0223
    @staticmethod
    def get_source() -> Source:
        return Source.STEAM

    @staticmethod
    def get_duration() -> OfferDuration:
        return OfferDuration.CLAIMABLE

    def get_steam_category(self) -> int:
        raise NotImplementedError("Please implement this method")

    def get_offer_handlers(self, page: Page) -> list[OfferHandler]:
        return [OfferHandler(page.locator("#search_results a"), self.read_raw_offer)]

    def get_offers_url(self) -> str:
        params = {
            "maxprice": "free",
            "category1": self.get_steam_category(),  # Games or DLC
            "specials": 1,
        }

        return f"{SEARCH_URL}?{urllib.parse.urlencode(params)}"

    def get_page_ready_selector(self) -> str:
        return "#search_results"

    def get_validtext_locator(self, page: Page) -> Locator:
        raise NotImplementedError("Please implement this method")

    async def read_raw_offer(self, element: Locator) -> SteamRawOffer:
        title = await element.locator(".title").text_content()
        if title is None:
            raise ValueError("Couldn't find title.")

        appid = await element.get_attribute("data-ds-appid")
        if appid is None:
            raise ValueError(f"Couldn't find appid for {title}.")

        url = DETAILS_URL + str(appid)

        async with get_new_page(self.context) as page:
            await page.goto(url)

            await skip_age_verification(page)
            await page.wait_for_selector(".game_area_purchase")

            img_url = await page.locator(".game_header_image_full").get_attribute("src")
            if img_url is None:
                raise ValueError(f"Couldn't find image for {title}.")

            # Get the resolved text here because the text_content() contains special characters
            text = await page.locator(".game_purchase_discount_quantity").inner_text()
            if text is None:
                raise ValueError(f"Couldn't find valid date for {title}.")

        return SteamRawOffer(
            title=title,
            url=url,
            img_url=img_url,
            appid=int(appid),
            text=text,
        )

    def normalize_offers(self, raw_offers: list[SteamRawOffer]) -> list[Offer]:  # type: ignore
        normalized_offers: list[Offer] = []

        now = datetime.now(timezone.utc)

        for raw_offer in raw_offers:
            rawtext = f"<title>{raw_offer.title}</title>"
            rawtext += f"<appid>{raw_offer.appid}</appid>"
            rawtext += f"<text>{raw_offer.text}</text>"

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
                    logger.warning(f"Couldn't parse date {maybe_date}.")

            probable_game_name = clean_title(raw_offer.title, self.get_type())

            offer = Offer(
                source=self.get_source(),
                duration=self.get_duration(),
                type=self.get_type(),
                title=raw_offer.title,
                probable_game_name=probable_game_name,
                seen_last=now,
                valid_to=valid_to,
                rawtext=rawtext,
                url=raw_offer.url,
            )

            normalized_offers.append(offer)

        return normalized_offers

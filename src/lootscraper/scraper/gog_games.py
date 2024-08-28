from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from os import link

from playwright.async_api import Error, Locator, Page

from lootscraper.browser import get_new_page
from lootscraper.common import OfferDuration
from lootscraper.database import Offer
from lootscraper.scraper.gog_base import GogBaseScraper
from lootscraper.scraper.scraper_base import OfferHandler, RawOffer

logger = logging.getLogger(__name__)

BASE_URL = "https://www.gog.com"
OFFER_URL = BASE_URL + "/#giveaway"


@dataclass(kw_only=True)
class GogRawOffer(RawOffer):
    valid_to: str | None = None


class GogGamesScraper(GogBaseScraper):
    @staticmethod
    def get_duration() -> OfferDuration:
        return OfferDuration.CLAIMABLE

    def get_offers_url(self) -> str:
        return OFFER_URL

    def get_page_ready_selector(self) -> str:
        return ".wrapper"

    def get_offer_handlers(self, page: Page) -> list[OfferHandler]:
        return [
            OfferHandler(
                page.locator("a.giveaway-banner"),
                self.read_raw_offer_v1,
                self.normalize_offer,
            ),
            OfferHandler(
                page.locator(
                    "a.big-spot",
                    has=page.locator('[ng-if="tile.isFreeVisible"]'),
                ),
                self.read_raw_offer_v2,
                self.normalize_offer,
            ),
            OfferHandler(
                page.locator("giveaway"),
                self.read_raw_offer_v3,
                self.normalize_offer,
            ),
        ]

    async def page_loaded_hook(self, page: Page) -> None:
        await GogBaseScraper.switch_to_english(page)

    async def read_raw_offer_v1(self, element: Locator) -> GogRawOffer:
        title = await element.locator(".giveaway-banner__title").text_content()
        if title is None:
            raise ValueError("Could not read title")
        title = (
            title.strip()
            .removeprefix("Claim ")
            .removesuffix(" and don't miss the best GOG offers in the future!")
        )
        valid_to = await element.locator("gog-countdown-timer").get_attribute(
            "end-date",
        )
        url = await element.get_attribute("href")
        if url is not None:
            url = BASE_URL + url
        img_url = GogGamesScraper.sanitize_img_url(
            await element.locator(
                '.giveaway-banner__image source[type="image/png"]:not([media])',
            ).get_attribute("srcset"),
        )

        return GogRawOffer(
            title=title,
            valid_to=valid_to,
            url=url,
            img_url=img_url,
        )

    async def read_raw_offer_v2(
        self,
        element: Locator,
    ) -> GogRawOffer | None:
        try:
            price = element.locator('[ng-if="tile.isFreeVisible"]')
            value = await price.text_content()
        except Error:
            logger.debug("Element doesn't seem to be free. Skipping.")
            return None
        if value is None or "free" not in value:
            logger.debug("Element doesn't seem to be free.")
            return None

        try:
            href = str(await element.get_attribute("href"))
            url = href if href.startswith("http") else BASE_URL + href
            return await self.read_offer_from_details_page(url)
        except Error:
            logger.warning("Could not read url for GOG variant 2.")
            return None

    async def read_raw_offer_v3(
        self,
        element: Locator,
    ) -> GogRawOffer | None:
        try:
            link = element.locator("a.giveaway__overlay-link")
            href = str(await link.get_attribute("href"))
            url = href if href.startswith("http") else BASE_URL + href
            return await self.read_offer_from_details_page(url)
        except Error as err:
            logger.warning(f"Could not read url for GOG variant 3 ({err}).")
            return None

    async def read_offer_from_details_page(
        self,
        url: str,
    ) -> GogRawOffer:
        async with get_new_page(self.context) as page:
            await page.goto(url, timeout=30000)

            title = await page.locator(".productcard-basics__title").text_content()
            if title is None:
                raise ValueError("Couldn't find title.")

            img_url = GogGamesScraper.sanitize_img_url(
                await page.locator(".productcard-player__logo").get_attribute("srcset"),
            )
            if img_url is None:
                raise ValueError(f"Couldn't find image for {title}.")

            return GogRawOffer(
                title=title,
                url=url,
                img_url=img_url,
            )

    def normalize_offer(self, raw_offer: RawOffer) -> Offer:
        if not isinstance(raw_offer, GogRawOffer):
            raise TypeError("Wrong type of raw offer.")

        rawtext = {
            "title": raw_offer.title,
        }
        if raw_offer.valid_to:
            rawtext["enddate"] = raw_offer.valid_to

        valid_to = None
        if raw_offer.valid_to:
            try:
                valid_to_unix = int(raw_offer.valid_to) / 1000
                valid_to = datetime.fromtimestamp(
                    valid_to_unix,
                    tz=timezone.utc,
                )
            except ValueError:
                valid_to = None

        nearest_url = raw_offer.url if raw_offer.url else OFFER_URL

        return Offer(
            source=GogGamesScraper.get_source(),
            duration=GogGamesScraper.get_duration(),
            type=GogGamesScraper.get_type(),
            title=raw_offer.title,
            probable_game_name=raw_offer.title,
            seen_last=datetime.now(timezone.utc),
            valid_to=valid_to,
            rawtext=rawtext,
            url=nearest_url,
            img_url=raw_offer.img_url,
        )

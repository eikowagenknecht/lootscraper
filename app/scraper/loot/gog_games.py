import logging
from dataclasses import dataclass
from datetime import datetime, timezone

from playwright.async_api import Error, Locator, Page

from app.browser import get_new_page
from app.common import OfferDuration
from app.database import Offer
from app.scraper.loot.gog_base import GogBaseScraper
from app.scraper.loot.scraper import OfferHandler, RawOffer

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
        return ".content.cf"

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
            "end-date"
        )
        url = await element.get_attribute("href")
        if url is not None:
            url = BASE_URL + url
        img_url = GogGamesScraper.sanitize_img_url(
            await element.locator(
                '.giveaway-banner__image source[type="image/png"]:not([media])'
            ).get_attribute("srcset")
        )

        return GogRawOffer(
            title=title,
            valid_to=valid_to,
            url=url,
            img_url=img_url,
        )

    async def read_raw_offer_v2(self, element: Locator) -> GogRawOffer | None:
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
            if href.startswith("http"):
                url = href
            else:
                url = BASE_URL + href
            return await self.read_offer_from_details_page(url)
        except Error:
            logger.warning("Could not read url for GOG variant 2.")
            return None

    async def read_offer_from_details_page(self, url: str) -> GogRawOffer:
        async with get_new_page(self.context) as page:
            await page.goto(url)

            title = await page.locator(".productcard-basics__title").text_content()
            if title is None:
                raise ValueError("Couldn't find title.")

            img_url = GogGamesScraper.sanitize_img_url(
                await page.locator(".productcard-player__logo").get_attribute("srcset")
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
            raise ValueError("Wrong type of raw offer.")

        rawtext = f"<title>{raw_offer.title}</title>"
        if raw_offer.valid_to:
            rawtext += f"<enddate>{raw_offer.valid_to}</enddate>"
        title = raw_offer.title

        valid_to = None
        if raw_offer.valid_to:
            try:
                valid_to_unix = int(raw_offer.valid_to) / 1000
                valid_to = datetime.utcfromtimestamp(valid_to_unix).replace(
                    tzinfo=timezone.utc
                )
            except ValueError:
                valid_to = None

        nearest_url = raw_offer.url if raw_offer.url else OFFER_URL

        return Offer(
            source=GogGamesScraper.get_source(),
            duration=GogGamesScraper.get_duration(),
            type=GogGamesScraper.get_type(),
            title=title,
            probable_game_name=title,
            seen_last=datetime.now(timezone.utc),
            valid_to=valid_to,
            rawtext=rawtext,
            url=nearest_url,
            img_url=raw_offer.img_url,
        )

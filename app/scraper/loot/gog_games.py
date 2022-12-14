import logging
from dataclasses import dataclass
from datetime import datetime, timezone

from playwright.async_api import Error, Locator

from app.common import OfferDuration
from app.pagedriver import get_new_page
from app.scraper.loot.gog_base import GogBaseScraper
from app.scraper.loot.scraper import RawOffer
from app.sqlalchemy import Offer

logger = logging.getLogger(__name__)

BASE_URL = "https://www.gog.com"
OFFER_URL = BASE_URL + "/#giveaway"


@dataclass
class GogRawOffer(RawOffer):
    valid_to: str | None = None


class GogGamesScraper(GogBaseScraper):
    @staticmethod
    def get_duration() -> OfferDuration:
        return OfferDuration.CLAIMABLE

    async def read_offers_from_page(self) -> list[Offer]:
        raw_offers: list[GogRawOffer] = []

        async with get_new_page(self.context) as page:
            await page.goto(OFFER_URL)
            try:
                await page.wait_for_selector(".content.cf")
            except Error as e:
                logger.error(f"Page could not be read: {e}")
                return []

            try:
                await GogGamesScraper.switch_to_english(page)
            except (Error, ValueError) as e:
                logger.error(f"Couldn't switch to English: {e}")
                return []

            # Check giveaway variant 1
            try:
                await page.wait_for_selector("a.giveaway-banner")
                element = page.locator("a.giveaway-banner").first
                raw_offers.append(await GogGamesScraper.read_raw_offer(element))
            except Error as e:
                logger.info(
                    f"Couldn't fine any giveaways (v1). Probably there are none: {e}"
                )

            # Check giveaway variant 2
            try:
                # await page.wait_for_selector("a.big-spot")
                elements = page.locator(
                    "a.big-spot",
                    has=page.locator('[ng-if="tile.isFreeVisible"]'),
                )
                no_res = await elements.count()

                offer_urls: list[str] = []
                for i in range(no_res):
                    element = elements.nth(i)
                    try:
                        price = element.locator('[ng-if="tile.isFreeVisible"]')
                        value = await price.text_content()
                    except Error:
                        logger.debug("Element doesn't seem to be free.")
                        continue

                    if value is None:
                        logger.debug("Element doesn't seem to be free.")
                        continue
                    if "free" not in value:
                        # Skip special offers that are not free
                        continue

                    try:
                        relative_path = str(await element.get_attribute("href"))
                        url = BASE_URL + relative_path
                        # Do not add duplicates
                        if url not in offer_urls:
                            offer_urls.append(url)
                    except Error:
                        logger.warning("Could not read url for GOG variant 2")
                        continue
                for url in offer_urls:
                    raw_offers.append(await self.read_offer_from_details_page(url))
            except Error as e:
                logger.info(
                    f"Couldn't fine any giveaways (v2). Probably there are none: {e}"
                )

        normalized_offers = GogGamesScraper.normalize_offers(raw_offers)

        return normalized_offers

    @staticmethod
    async def read_raw_offer(element: Locator) -> GogRawOffer:
        title = await element.locator(".giveaway-banner__title").text_content()
        if title is not None:
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

    async def read_offer_from_details_page(self, url: str) -> GogRawOffer:
        async with get_new_page(self.context) as page:
            await page.goto(url)

            title = await page.locator(".productcard-basics__title").text_content()
            img_url = GogGamesScraper.sanitize_img_url(
                await page.locator(".productcard-player__logo").get_attribute("srcset")
            )

            return GogRawOffer(
                url=url,
                title=title,
                img_url=img_url,
            )

    @staticmethod
    def normalize_offers(raw_offers: list[GogRawOffer]) -> list[Offer]:
        normalized_offers: list[Offer] = []

        for raw_offer in raw_offers:
            # Raw text
            if not raw_offer.title:
                logger.error(f"Error with offer, has no title: {raw_offer}")
                continue

            rawtext = f"<title>{raw_offer.title}</title>"

            if raw_offer.valid_to:
                rawtext += f"<enddate>{raw_offer.valid_to}</enddate>"

            # Title
            # Contains additional text that needs to be stripped
            title = raw_offer.title

            # Valid to
            valid_to_stamp = None
            if raw_offer.valid_to:
                try:
                    valid_to_unix = int(raw_offer.valid_to) / 1000
                    valid_to_stamp = datetime.utcfromtimestamp(valid_to_unix).replace(
                        tzinfo=timezone.utc
                    )
                except ValueError:
                    valid_to_stamp = None

            nearest_url = raw_offer.url if raw_offer.url else OFFER_URL
            offer = Offer(
                source=GogGamesScraper.get_source(),
                duration=GogGamesScraper.get_duration(),
                type=GogGamesScraper.get_type(),
                title=title,
                probable_game_name=title,
                seen_last=datetime.now(timezone.utc),
                valid_to=valid_to_stamp,
                rawtext=rawtext,
                url=nearest_url,
                img_url=raw_offer.img_url,
            )

            normalized_offers.append(offer)

        return normalized_offers

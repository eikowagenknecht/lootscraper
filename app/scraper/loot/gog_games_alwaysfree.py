import logging
from datetime import datetime, timezone

from playwright.async_api import Error, Locator

from app.common import OfferDuration
from app.pagedriver import get_new_page
from app.scraper.loot.gog_base import GogBaseScraper
from app.scraper.loot.scraper import RawOffer
from app.sqlalchemy import Offer

logger = logging.getLogger(__name__)

BASE_URL = "https://www.gog.com"
OFFER_URL = BASE_URL + "/partner/free_games"


class GogGamesAlwaysFreeScraper(GogBaseScraper):
    @staticmethod
    def get_duration() -> OfferDuration:
        return OfferDuration.ALWAYS

    async def read_offers_from_page(self) -> list[Offer]:
        raw_offers: list[RawOffer] = []

        async with get_new_page(self.context) as page:
            await page.goto(OFFER_URL)
            try:
                await page.wait_for_selector(".content.cf")
            except Error as e:
                logger.error(f"Page could not be read: {e}")
                return []

            try:
                await GogGamesAlwaysFreeScraper.switch_to_english(page)
            except (Error, ValueError) as e:
                logger.error(f"Couldn't switch to English: {e}")
                return []

            try:
                await page.wait_for_selector(".partners__game-list")
            except Error as e:
                logger.info(f"Giveaways couldn't load, probably there are none: {e}")

            elements = page.locator(".product-row__link")

            try:
                no_res = await elements.count()

                for i in range(no_res):
                    element = elements.nth(i)
                    try:
                        raw_offer = await GogGamesAlwaysFreeScraper.read_raw_offer(
                            element
                        )
                        raw_offers.append(raw_offer)
                    except Error as e:
                        logger.error(f"Error loading offer: {e}")
            except Error as e:
                logger.error(f"Error loading offers: {e}")

        normalized_offers = GogGamesAlwaysFreeScraper.normalize_offers(raw_offers)

        return normalized_offers

    @staticmethod
    async def read_raw_offer(element: Locator) -> RawOffer:
        title = await element.locator(".product-title__text").text_content()
        url = await element.get_attribute("href")
        if url is not None:
            url = BASE_URL + url
        img_url = GogGamesAlwaysFreeScraper.sanitize_img_url(
            await element.locator("img").get_attribute("srcset")
        )

        return RawOffer(
            title=title,
            url=url,
            img_url=img_url,
        )

    @staticmethod
    def normalize_offers(raw_offers: list[RawOffer]) -> list[Offer]:
        normalized_offers: list[Offer] = []

        for raw_offer in raw_offers:
            # Raw text
            if not raw_offer.title:
                logger.error(f"Error with offer, has no title: {raw_offer}")
                continue

            rawtext = f"<title>{raw_offer.title}</title>"

            # Title
            # Contains additional text that needs to be stripped
            title = raw_offer.title

            # Valid to
            nearest_url = raw_offer.url if raw_offer.url else OFFER_URL
            offer = Offer(
                source=GogGamesAlwaysFreeScraper.get_source(),
                duration=GogGamesAlwaysFreeScraper.get_duration(),
                type=GogGamesAlwaysFreeScraper.get_type(),
                title=title,
                probable_game_name=title,
                seen_last=datetime.now(timezone.utc),
                rawtext=rawtext,
                url=nearest_url,
                img_url=raw_offer.img_url,
            )

            normalized_offers.append(offer)
        return normalized_offers

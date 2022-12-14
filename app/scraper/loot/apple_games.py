import logging
from datetime import datetime, timezone

from app.common import OfferDuration, OfferType, Source
from app.scraper.loot.scraper import RawOffer, Scraper
from app.sqlalchemy import Offer

logger = logging.getLogger(__name__)

ROOT_URL = (
    "https://appsliced.co/apps/iphone?sort=latest&price=free&cat%5B0%5D=6014&page=1"
)

XPATH_SEARCH_RESULTS = (
    """//article[contains(concat(" ", normalize-space(@class), " "), " app ")]"""
)
SUBPATH_TITLE = """.//div[contains(concat(" ", normalize-space(@class), " "), " title ")]//a"""  # /text()
SUBPATH_IMAGE = """.//div[contains(concat(" ", normalize-space(@class), " "), " icon ")]//img"""  # Attr "src"


class AppleGamesScraper(Scraper):
    @staticmethod
    def get_source() -> Source:
        return Source.APPLE

    @staticmethod
    def get_type() -> OfferType:
        return OfferType.GAME

    @staticmethod
    def get_duration() -> OfferDuration:
        return OfferDuration.CLAIMABLE

    async def read_offers_from_page(self) -> list[Offer]:
        self.context.get(ROOT_URL)
        raw_offers: list[RawOffer] = []

        try:
            # Wait until the page loaded
            WebDriverWait(self.context, Scraper.get_max_wait_seconds()).until(
                EC.presence_of_element_located((By.XPATH, XPATH_SEARCH_RESULTS))
            )

            offer_elements = self.context.find_elements(By.XPATH, XPATH_SEARCH_RESULTS)
            for offer_element in offer_elements:
                raw_offers.append(AppleGamesScraper.read_raw_offer(offer_element))

        except WebDriverException:
            logger.info(
                f"Free search results took longer than {Scraper.get_max_wait_seconds()} to load, probably there are none"
            )

        normalized_offers = AppleGamesScraper.normalize_offers(raw_offers)
        categorized_offers = self.categorize_offers(normalized_offers)

        return categorized_offers

    @staticmethod
    def read_raw_offer(element: WebElement) -> RawOffer:
        title_str = None
        url_str = None
        img_url_str = None

        try:
            title_str = str(
                element.find_element(By.XPATH, SUBPATH_TITLE).get_attribute("title")
            )
        except WebDriverException:
            # Nothing to do here, string stays empty
            pass

        try:
            url_str = str(element.find_element(By.XPATH, SUBPATH_TITLE).get_attribute("href"))  # type: ignore
        except WebDriverException:
            # Nothing to do here, string stays empty
            pass

        try:
            img_url_str = str(
                element.find_element(By.XPATH, SUBPATH_IMAGE).get_attribute("src")
            )
        except WebDriverException:
            # Nothing to do here, string stays empty
            pass

        return RawOffer(
            title=title_str,
            url=url_str,
            img_url=img_url_str,
        )

    @staticmethod
    def normalize_offers(raw_offers: list[RawOffer]) -> list[Offer]:
        normalized_offers: list[Offer] = []

        for raw_offer in raw_offers:
            # Raw text
            if not raw_offer.title:
                logger.error(f"Error with offer, has no title: {raw_offer}")
                continue

            # Raw text
            rawtext = f"<title>{raw_offer.title}</title>"

            # Title
            title = raw_offer.title

            nearest_url = raw_offer.url if raw_offer.url else ROOT_URL
            offer = Offer(
                source=AppleGamesScraper.get_source(),
                duration=AppleGamesScraper.get_duration(),
                type=AppleGamesScraper.get_type(),
                title=title,
                probable_game_name=title,
                seen_last=datetime.now(timezone.utc),
                rawtext=rawtext,
                url=nearest_url,
                img_url=raw_offer.img_url,
            )

            if title is not None and len(title) > 0:
                normalized_offers.append(offer)

        return normalized_offers

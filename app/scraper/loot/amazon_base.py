from dataclasses import dataclass

from playwright.async_api import Error, Locator

from app.common import OfferDuration, Source
from app.scraper.loot.scraper import RawOffer, Scraper

BASE_URL = "https://gaming.amazon.com"
OFFER_URL = BASE_URL + "/home"


@dataclass(kw_only=True)
class AmazonRawOffer(RawOffer):
    valid_to: str | None = None


class AmazonBaseScraper(Scraper):  # pylint: disable=W0223
    @staticmethod
    def get_source() -> Source:
        return Source.AMAZON

    @staticmethod
    def get_duration() -> OfferDuration:
        return OfferDuration.CLAIMABLE

    def offers_expected(self) -> bool:
        return True

    def get_offers_url(self) -> str:
        return OFFER_URL

    def get_page_ready_selector(self) -> str:
        return ".offer-list__content"

    async def read_base_raw_offer(self, element: Locator) -> AmazonRawOffer:
        title = await element.locator(
            ".item-card-details__body__primary h3"
        ).text_content()
        if title is None:
            raise ValueError("Couldn't find title.")

        valid_to = await element.locator(
            ".item-card__availability-date p"
        ).text_content()
        if valid_to is None:
            raise ValueError(f"Couldn't find valid to for {title}.")

        img_url = await element.locator(
            '[data-a-target="card-image"] img'
        ).get_attribute("src")
        if img_url is None:
            raise ValueError(f"Couldn't find image for {title}.")

        url = BASE_URL

        try:
            path = await element.locator(
                '[data-a-target="learn-more-card"]'
            ).get_attribute("href", timeout=500)
            if path is not None and not path.startswith("http"):
                url += path
        except Error:
            # Some offers are claimed on site and don't have a specific path.
            # That's fine.
            pass

        return AmazonRawOffer(
            title=title,
            valid_to=valid_to,
            url=url,
            img_url=img_url,
        )

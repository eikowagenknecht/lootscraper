import logging
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from time import sleep

from selenium.common.exceptions import WebDriverException
from selenium.webdriver.chrome.webdriver import WebDriver
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from app.common import OfferType, Source
from app.scraper.info.utils import clean_game_title, clean_loot_title
from app.scraper.loot.scraper import Scraper
from app.sqlalchemy import Offer

logger = logging.getLogger(__name__)

SCRAPER_NAME = "Amazon Prime"
ROOT_URL = "https://gaming.amazon.com/home"
MAX_WAIT_SECONDS = 15  # Needs to be quite high in Docker for first run
XPATH_WAIT = '//div[@data-a-target="offer-section-FGWP_FULL"]'
XPATH_LOOT = (
    '//div[@data-a-target="offer-list-IN_GAME_LOOT"]//div[@class="item-card__action"]'
)
XPATH_GAMES = (
    '//div[@data-a-target="offer-list-FGWP_FULL"]//div[@class="item-card__action"]'
)
SUBPATH_TITLE = './/div[contains(concat(" ", normalize-space(@class), " "), " item-card-details__body__primary ")]//p'
SUBPATH_ENDDATE = './/div[contains(concat(" ", normalize-space(@class), " "), " item-card__availability-date ")]//p'
SUBPATH_LINK = './a[@data-a-target="learn-more-card"]'
SUBPATH_IMG = './/div[@data-a-target="card-image"]//img'


@dataclass
class RawOffer:
    title: str | None = None
    valid_to: str | None = None
    url: str | None = None
    img_url: str | None = None


class AmazonScraper(Scraper):
    @staticmethod
    def scrape(
        driver: WebDriver, options: dict[str, bool] = None
    ) -> dict[str, list[Offer]]:
        if (
            options
            and not options[OfferType.GAME.name]
            and not options[OfferType.LOOT.name]
        ):
            return {}

        driver.get(ROOT_URL)

        offers = {}

        if not options or options[OfferType.GAME.name]:
            logger.info(f"Analyzing {ROOT_URL} for {OfferType.GAME.value} offers")
            offers[OfferType.GAME.name] = AmazonScraper.read_offers_from_page(
                OfferType.GAME, driver
            )

        if not options or options[OfferType.LOOT.name]:
            logger.info(f"Analyzing {ROOT_URL} for {OfferType.LOOT.value} offers")
            offers[OfferType.LOOT.name] = AmazonScraper.read_offers_from_page(
                OfferType.LOOT, driver
            )

        return offers

    @staticmethod
    def read_offers_from_page(offer_type: OfferType, driver: WebDriver) -> list[Offer]:
        try:
            # Wait until the page loaded
            WebDriverWait(driver, MAX_WAIT_SECONDS).until(
                EC.presence_of_element_located((By.XPATH, XPATH_WAIT))
            )
            sleep(1)  # Otherwise the first element sometimes is not correctly evaluated
        except WebDriverException:
            logger.error(f"Page took longer than {MAX_WAIT_SECONDS} to load")
            return []

        match offer_type:
            case OfferType.LOOT:
                search_xpath = XPATH_LOOT
            case OfferType.GAME:
                search_xpath = XPATH_GAMES
            case _:
                raise ValueError

        try:
            elements: list[WebElement] = driver.find_elements(By.XPATH, search_xpath)
        except WebDriverException:
            logger.error("Root element not found, could not scrape!")
            return []

        raw_offers: list[RawOffer] = []
        title_str: str | None
        valid_to_str: str | None
        url_str: str | None

        for element in elements:
            try:
                title: WebElement = element.find_element(By.XPATH, SUBPATH_TITLE)
                title_str = title.text
            except WebDriverException:
                # Nothing to do here, string stays empty
                title_str = None

            try:
                enddate: WebElement = element.find_element(By.XPATH, SUBPATH_ENDDATE)
                valid_to_str = enddate.text
            except WebDriverException:
                # Nothing to do here, string stays empty
                valid_to_str = None

            try:
                url: WebElement = element.find_element(By.XPATH, SUBPATH_LINK)
                link: str | None = url.get_attribute("href")  # type: ignore
                if link is not None:
                    url_str = link
            except WebDriverException:
                # Nothing to do here, string stays empty
                url_str = None

            try:
                img_url: WebElement = element.find_element(By.XPATH, SUBPATH_IMG)
                link2: str | None = img_url.get_attribute("src")  # type: ignore
                if link2 is not None:
                    img_url_str = link2
            except WebDriverException:
                # Nothing to do here, string stays empty
                img_url_str = None

            raw_offers.append(
                RawOffer(
                    title=title_str,
                    valid_to=valid_to_str,
                    url=url_str,
                    img_url=img_url_str,
                )
            )

        normalized_offers = AmazonScraper.normalize_offers(offer_type, raw_offers)

        return normalized_offers

    @staticmethod
    def normalize_offers(
        offer_type: OfferType, raw_offers: list[RawOffer]
    ) -> list[Offer]:
        normalized_offers: list[Offer] = []

        for raw_offer in raw_offers:
            # Raw text
            if not raw_offer.title:
                logger.error(f"Error with offer, has no title: {raw_offer}")
                continue

            rawtext = f"<title>{raw_offer.title}</title>"

            # Title
            probable_game_name: str | None = None
            if offer_type == OfferType.GAME:
                probable_game_name = clean_game_title(raw_offer.title)
            else:
                probable_game_name = clean_loot_title(raw_offer.title)

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
                    pass

            nearest_url = raw_offer.url if raw_offer.url else ROOT_URL
            offer = Offer(
                source=Source.AMAZON,
                type=offer_type,
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

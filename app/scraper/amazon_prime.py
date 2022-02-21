import logging
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone

from selenium.common.exceptions import WebDriverException
from selenium.webdriver.chrome.webdriver import WebDriver
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from app.common import LootOffer, OfferType
from app.pagedriver import get_pagedriver

SCRAPER_NAME = "Amazon Prime"
ROOT_URL = "https://gaming.amazon.com/home"
MAX_WAIT_SECONDS = 60  # Needs to be quite high in Docker for first run
XPATH_LOOT = (
    '//div[@data-a-target="offer-list-IN_GAME_LOOT"]//div[@data-a-target="Offer"]'
)
XPATH_GAMES = (
    '//div[@data-a-target="offer-list-FGWP_FULL"]//div[@data-a-target="Offer"]'
)
SUBPATH_TITLE = './/div[contains(concat(" ", normalize-space(@class), " "), " offer__body__titles")]/h3'
SUBPATH_PARAGRAPH = './/div[contains(concat(" ", normalize-space(@class), " "), " offer__body__titles")]/p'
SUBPATH_ENDDATE = './/p[@data-test-selector="offer-end-time"]/span'
SUBPATH_LINK = './/a[@data-a-target="learn-more-card"]'
SUBPATH_IMG = './/img[@class="tw-image"]'


@dataclass
class RawOffer:
    title: str
    paragraph: str
    valid_to: str
    url: str
    img_url: str


class AmazonScraper:
    @staticmethod
    def scrape() -> list[LootOffer]:
        logging.info(f"Start scraping of {SCRAPER_NAME}")
        offers = []

        try:
            driver: WebDriver
            with get_pagedriver() as driver:
                driver.get(ROOT_URL)

                logging.info(f"Analyzing {ROOT_URL} for {OfferType.GAME.value} offers")
                offers.extend(
                    AmazonScraper.read_offers_from_page(OfferType.GAME, driver)
                )
                logging.info(f"Analyzing {ROOT_URL} for {OfferType.LOOT.value} offers")
                offers.extend(
                    AmazonScraper.read_offers_from_page(OfferType.LOOT, driver)
                )
                driver.quit()
        except WebDriverException as err:  # type: ignore
            logging.error(f"Failure starting Chrome WebDriver, aborting: {err.msg}")  # type: ignore
            raise err

        return offers

    @staticmethod
    def read_offers_from_page(
        offer_type: OfferType, driver: WebDriver
    ) -> list[LootOffer]:
        try:
            # Wait until the page loaded
            WebDriverWait(driver, MAX_WAIT_SECONDS).until(
                EC.presence_of_element_located((By.CLASS_NAME, "offer"))
            )
        except WebDriverException:  # type: ignore
            logging.error(f"Page took longer than {MAX_WAIT_SECONDS} to load")
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
        except WebDriverException:  # type: ignore
            logging.error("Root element not found, could not scrape!")
            return []

        raw_offers: list[RawOffer] = []
        title_str: str
        paragraph_str: str
        valid_to_str: str
        url_str: str

        for element in elements:
            try:
                title: WebElement = element.find_element(By.XPATH, SUBPATH_TITLE)
                title_str = title.text
            except WebDriverException:  # type: ignore
                # Nothing to do here, string stays empty
                title_str = ""

            try:
                paragraph: WebElement = element.find_element(
                    By.XPATH, SUBPATH_PARAGRAPH
                )
                paragraph_str = paragraph.text
            except WebDriverException:  # type: ignore
                # Nothing to do here, string stays empty
                paragraph_str = ""

            try:
                enddate: WebElement = element.find_element(By.XPATH, SUBPATH_ENDDATE)
                valid_to_str = enddate.text
            except WebDriverException:  # type: ignore
                # Nothing to do here, string stays empty
                valid_to_str = ""

            try:
                url: WebElement = element.find_element(By.XPATH, SUBPATH_LINK)
                link: str | None = url.get_attribute("href")  # type: ignore
                if link is not None:
                    url_str = link
            except WebDriverException:  # type: ignore
                # Nothing to do here, string stays empty
                url_str = ""

            try:
                img_url: WebElement = element.find_element(By.XPATH, SUBPATH_IMG)
                link: str | None = img_url.get_attribute("src")  # type: ignore
                if link is not None:
                    img_url_str = link
            except WebDriverException:  # type: ignore
                # Nothing to do here, string stays empty
                img_url_str = ""

            raw_offers.append(
                RawOffer(
                    title=title_str,
                    paragraph=paragraph_str,
                    valid_to=valid_to_str,
                    url=url_str,
                    img_url=img_url_str,
                )
            )

        normalized_offers = AmazonScraper.normalize_offers(offer_type, raw_offers)

        return normalized_offers

    @staticmethod
    def normalize_offers(
        offer_type: OfferType, offers: list[RawOffer]
    ) -> list[LootOffer]:
        normalized_offers: list[LootOffer] = []

        for offer in offers:
            # Raw text
            rawtext = (
                f"<title>{offer.title}</title>"
                f"<paragraph>{offer.paragraph}</paragraph>"
            )

            # Title
            parsed_heads = offer.title.split(": ", 1)
            title = parsed_heads[0]
            subtitle = parsed_heads[1] if len(parsed_heads) == 2 else ""

            # Paragraph
            publisher = offer.paragraph

            # Date
            # This is a little bit more complicated as only month and day are
            # displayed on the site. The year is guessed assuming that old
            # offers are not shown any more. "Old" means older than yesterday
            # to avoid time zone problems.
            # TODO: Save this in UTC time instead of German time!
            parsed_date = datetime.strptime(offer.valid_to, "%b %d").date()
            guessed_end_date = date(
                date.today().year, parsed_date.month, parsed_date.day
            )
            yesterday = date.today() - timedelta(days=1)
            if guessed_end_date < yesterday:
                guessed_end_date = guessed_end_date.replace(
                    year=guessed_end_date.year + 1
                )

            # Add 1 day because of the notation
            # ("Valid to 01 Jan 2022" means "Valid to 2022-01-02 00:00:00")
            normalized_end_date = datetime.combine(
                guessed_end_date + timedelta(days=1),
                time.min,
            ).replace(tzinfo=timezone.utc)

            nearest_url = offer.url if offer.url else ROOT_URL
            loot_offer = LootOffer(
                seen_last=datetime.now(timezone.utc),
                source=SCRAPER_NAME,
                type=offer_type.value,
                rawtext=rawtext,
                title=title,
                subtitle=subtitle,
                publisher=publisher,
                valid_to=normalized_end_date if normalized_end_date else None,
                url=nearest_url,
                img_url=offer.img_url,
            )

            normalized_offers.append(loot_offer)
            logging.info(f"Found offer for {loot_offer.title}")
        return normalized_offers

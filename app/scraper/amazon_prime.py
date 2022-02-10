from dataclasses import dataclass
from datetime import datetime

from selenium.common.exceptions import WebDriverException
from selenium.webdriver.chrome.webdriver import WebDriver
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from app.common import TIMESTAMP_SHORT, LootOffer, OfferType
from app.pagedriver import get_pagedriver

SCRAPER_NAME = "Amazon Prime"
ROOT_URL = "https://gaming.amazon.com/home"
MAX_WAIT_SECONDS = 10
BASE_ELEMENT_LOOT = "offer-list-IN_GAME_LOOT"
BASE_ELEMENT_GAMES = "offer-list-FGWP_FULL"


@dataclass
class RawOffer:
    title: str
    paragraph: str
    enddate: str


class AmazonScraper:
    @staticmethod
    def scrape(use_docker_settings: bool) -> list[LootOffer]:
        amazon_offers = []

        driver: WebDriver
        with get_pagedriver(use_docker_settings) as driver:
            driver.get(ROOT_URL)

            amazon_offers.extend(
                AmazonScraper.read_offers_from_page(OfferType.GAME, driver)
            )
            amazon_offers.extend(
                AmazonScraper.read_offers_from_page(OfferType.LOOT, driver)
            )
            driver.quit()

        return amazon_offers

    @staticmethod
    def read_offers_from_page(
        offer_type: OfferType, driver: WebDriver
    ) -> list[LootOffer]:
        # Wait until the page loaded
        WebDriverWait(driver, MAX_WAIT_SECONDS).until(
            EC.presence_of_element_located((By.CLASS_NAME, "offer"))
        )

        match offer_type:
            case OfferType.LOOT:
                search_element = BASE_ELEMENT_LOOT
            case OfferType.GAME:
                search_element = BASE_ELEMENT_GAMES
            case _:
                raise ValueError

        try:
            elements: list[WebElement] = driver.find_elements(
                By.XPATH,
                '//div[@data-a-target="'
                + search_element
                + '"]//div[@data-a-target="Offer"]',
            )
        except WebDriverException:  # type: ignore
            # TODO: Cancel this scraping, root element not found!
            pass

        raw_offers: list[RawOffer] = []
        title_str: str
        paragraph_str: str
        enddate_str: str

        for element in elements:
            try:
                title: WebElement = element.find_element(
                    By.XPATH,
                    './/div[contains(concat(" ", normalize-space(@class), " "), " offer__body__titles")]/h3',
                )
                title_str = title.text
            except WebDriverException:  # type: ignore
                # Nothing to do here, string stays empty
                pass

            try:
                paragraph: WebElement = element.find_element(
                    By.XPATH,
                    './/div[contains(concat(" ", normalize-space(@class), " "), " offer__body__titles")]/p',
                )
                paragraph_str = paragraph.text
            except WebDriverException:  # type: ignore
                # Nothing to do here, string stays empty
                pass

            try:
                enddate: WebElement = element.find_element(
                    By.XPATH, './/p[@data-test-selector="offer-end-time"]/span'
                )
                enddate_str = enddate.text
            except WebDriverException:  # type: ignore
                # Nothing to do here, string stays empty
                pass

            raw_offers.append(RawOffer(title_str, paragraph_str, enddate_str))

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
                "<title>"
                + offer.title
                + "</title>"
                + "<paragraph>"
                + offer.paragraph
                + "</paragraph>"
            )

            # Title
            parsed_heads = offer.title.split(": ", 1)
            title = parsed_heads[0]
            subtitle = parsed_heads[1] if len(parsed_heads) == 2 else ""

            # Paragraph
            publisher = offer.paragraph

            # Date
            parsed_date = datetime.strptime(offer.enddate, "%b %d")
            guessed_end_date = datetime(
                datetime.now().year, parsed_date.month, parsed_date.day
            )
            if guessed_end_date < datetime.now():
                guessed_end_date = guessed_end_date.replace(
                    year=guessed_end_date.year + 1
                )

            loot_offer = LootOffer(
                source=SCRAPER_NAME,
                type=offer_type.value,
                rawtext=rawtext,
                title=title,
                subtitle=subtitle,
                publisher=publisher,
                enddate=guessed_end_date.strftime(TIMESTAMP_SHORT),
                url=ROOT_URL,
            )

            normalized_offers.append(loot_offer)
        return normalized_offers

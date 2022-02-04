from collections import namedtuple
from datetime import datetime

from selenium.webdriver.chrome.webdriver import WebDriver
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from app.common import LootOffer, OfferType
from app.pagedriver import get_pagedriver

AMAZON_PRIME_LOOT_URL = "https://gaming.amazon.com/home"
MAX_WAIT_SECONDS = 10
BASE_ELEMENT_LOOT = "offer-list-IN_GAME_LOOT"
BASE_ELEMENT_GAMES = "offer-list-FGWP_FULL"

RawOffer = namedtuple("RawOffer", "title paragraph enddate")


class AmazonScraper:
    def scrape(self, use_docker_settings: bool) -> list[LootOffer]:
        amazon_offers = []

        with get_pagedriver(use_docker_settings) as driver:
            driver.get(AMAZON_PRIME_LOOT_URL)

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

        elements = driver.find_elements(
            By.XPATH,
            '//div[@data-a-target="'
            + search_element
            + '"]//div[@data-a-target="Offer"]',
        )

        raw_offers: list[RawOffer] = []

        for element in elements:
            title: WebElement = element.find_element(
                By.XPATH,
                './/div[contains(concat(" ", normalize-space(@class), " "), " offer__body__titles")]/h3',
            ).text
            paragraph: WebElement = element.find_element(
                By.XPATH,
                './/div[contains(concat(" ", normalize-space(@class), " "), " offer__body__titles")]/p',
            )
            enddate: WebElement = element.find_element(
                By.XPATH, './/p[@data-test-selector="offer-end-time"]/span'
            )
            raw_offers.append(RawOffer(title.text, paragraph.text, enddate.text))

        normalized_offers = AmazonScraper.normalize_offers(offer_type, raw_offers)

        return normalized_offers

    @staticmethod
    def normalize_offers(
        offer_type: OfferType, offers: list[RawOffer]
    ) -> list[LootOffer]:
        normalized_offers: list[LootOffer] = []

        for offer in offers:
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

            # TODO: Maybe add an offset of some days here, depends on when amazon removes old offers from the page
            if guessed_end_date < datetime.now():
                guessed_end_date = guessed_end_date.replace(
                    year=guessed_end_date.year + 1
                )

            loot_offer = LootOffer(
                "Amazon Prime",
                offer_type.value,
                title,
                subtitle,
                publisher,
                guessed_end_date.strftime("%Y-%m-%d"),
            )

            normalized_offers.append(loot_offer)
        return normalized_offers

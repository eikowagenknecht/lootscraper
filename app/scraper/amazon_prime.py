from datetime import datetime

from selenium.webdriver.chrome.webdriver import WebDriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from ..datamodel import LootOffer
from ..pagedriver import get_pagedriver

AMAZON_PRIME_LOOT_URL = "https://gaming.amazon.com/home"
MAX_WAIT_SECONDS = 10


def scrape_amazon(docker: bool) -> list[LootOffer]:
    driver = get_pagedriver(docker)

    try:
        driver.get(AMAZON_PRIME_LOOT_URL)
        amazon_offers = []
        amazon_offers.extend(read_amazon_offers("Loot", driver))
        amazon_offers.extend(read_amazon_offers("Game", driver))
    finally:
        driver.quit()

    return amazon_offers


def read_amazon_offers(offer_type: str, driver: WebDriver) -> list[LootOffer]:
    WebDriverWait(driver, MAX_WAIT_SECONDS).until(
        EC.presence_of_element_located((By.CLASS_NAME, "offer"))
    )

    if offer_type == "Loot":
        search_element = "offer-list-IN_GAME_LOOT"
    else:
        search_element = "offer-list-FGWP_FULL"

    offers = driver.find_elements(
        By.XPATH,
        '//div[@data-a-target="' + search_element + '"]//div[@data-a-target="Offer"]',
    )

    normalized_offers = []

    for offer in offers:
        offer_name = offer.find_element(
            By.XPATH,
            './/div[contains(concat(" ", normalize-space(@class), " "), " offer__body__titles")]/h3',
        )
        offer_publisher = offer.find_element(
            By.XPATH,
            './/div[contains(concat(" ", normalize-space(@class), " "), " offer__body__titles")]/p',
        )
        offer_date = offer.find_element(
            By.XPATH, './/p[@data-test-selector="offer-end-time"]/span'
        )

        # Title
        parsed_heads = offer_name.text.split(": ", 1)
        title = parsed_heads[0]
        subtitle = parsed_heads[1] if len(parsed_heads) == 2 else ""
        publisher = offer_publisher.text

        # Date
        parsed_date = datetime.strptime(offer_date.text, "%b %d")
        guessed_end_date = datetime(
            datetime.now().year, parsed_date.month, parsed_date.day
        )
        if (
            guessed_end_date < datetime.now()
        ):  # Maybe add an offset of some days here, depends on when amazon removes old offers from the page
            guessed_end_date = guessed_end_date.replace(year=guessed_end_date.year + 1)

        loot_offer = LootOffer(
            "Amazon Prime",
            offer_type,
            title,
            subtitle,
            publisher,
            guessed_end_date.strftime("%Y-%m-%d"),
        )

        normalized_offers.append(loot_offer)

    return normalized_offers

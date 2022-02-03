import sqlite3
import sys
from argparse import ArgumentParser
from dataclasses import dataclass
from datetime import datetime

from typed_argparse import TypedArgs
from feedgen.feed import FeedGenerator
from pytz import timezone
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.webdriver import WebDriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

INJECTION_FILE = "inject.js"
DRIVER_PATH = R"C:\Entwicklung\Chromedriver\chromedriver.exe"
MAX_WAIT_SECONDS = 10
AMAZON_PRIME_LOOT_URL = "https://gaming.amazon.com/home"


@dataclass
class LootOffer:
    source: str
    type: str
    title: str
    subtitle: str
    publisher: str
    enddate: str


class Arguments(TypedArgs):
    docker: bool


def main() -> None:
    args = parse_commandline_arguments()

    amazon_offers = scrape_amazon(args.docker)

    database = prepare_database(args.docker)
    insert_offers(database, amazon_offers)
    all_offers = read_offers(database)

    for offer in all_offers:
        print(
            offer.type
            + ": "
            + offer.title
            + " || "
            + offer.subtitle
            + " || "
            + offer.publisher
            + " || "
            + offer.enddate
        )

    generate_feed(all_offers, args.docker)


def parse_commandline_arguments() -> Arguments:
    args = sys.argv[1:]

    parser = ArgumentParser(
        description="Parse loot from various files into an ATOM feed."
    )
    parser.add_argument(
        "-d",
        "--docker",
        action="store_true",
        dest="docker",
        default=False,
        help="use docker paths and options",
    )
    arguments = Arguments(parser.parse_args(args))

    return arguments


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


def get_pagedriver(docker: bool) -> webdriver.chrome.webdriver.WebDriver:
    options = Options()
    options.add_argument("--headless")
    options.add_argument(
        "--window-size=10000,10000"
    )  # To see everything. Default: 1920,1200
    options.add_argument("--lang=en-US")
    options.add_argument(
        "--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.39 Safari/537.36"
    )
    options.add_argument("--log-level=3")
    options.add_argument("--silent")

    if docker:
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        driver = webdriver.Chrome(options=options)
    else:
        serv = Service(DRIVER_PATH)
        driver = webdriver.Chrome(options=options, service=serv)

    # Inject JS
    with open(INJECTION_FILE, "r", encoding="utf-8") as file:
        js_to_inject = file.read()

    driver.execute_cdp_cmd(
        "Page.addScriptToEvaluateOnNewDocument", {"source": js_to_inject}
    )

    return driver


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


def prepare_database(docker: bool) -> sqlite3.Connection:
    dbfile = "/data/loot.db" if docker else "data/loot.db"
    db_connection = sqlite3.connect(dbfile)

    cur = db_connection.cursor()

    # Initialize database
    # TODO: Only do this if it's empty
    cur.execute("""DROP TABLE IF EXISTS loot""")
    cur.execute("""DROP TABLE IF EXISTS version""")
    cur.execute(
        """CREATE TABLE "loot" (
            "first_scraped_date" TEXT,
            "last_scraped_date" TEXT,
            "source" TEXT,
            "type" TEXT,
            "title" TEXT,
            "subtitle" TEXT,
            "publisher" TEXT,
            "valid_until" TEXT
        );"""
    )
    cur.execute(
        """CREATE TABLE "version" (
            "schema_version" INTEGER
        );"""
    )

    return db_connection


def insert_offers(db_connection: sqlite3.Connection, offers: list[LootOffer]) -> None:
    # TODO: Check offers against those in the database
    # TODO: Only insert offers that are new (type+title+subtitle match)
    cursor = db_connection.cursor()

    for offer in offers:
        cursor.execute(
            "INSERT INTO loot VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                "1234-56-78",
                "1234-56-78",
                "source",
                offer.type,
                offer.title,
                offer.subtitle,
                offer.publisher,
                offer.enddate,
            ),
        )


def read_offers(db_connection: sqlite3.Connection) -> list[LootOffer]:
    cursor = db_connection.cursor()
    cursor.execute(
        "SELECT source, type, title, subtitle, publisher, valid_until FROM loot ORDER BY type"
    )
    rows = cursor.fetchall()

    offers = []
    for row in rows:
        offers.append(LootOffer(row[0], row[1], row[2], row[3], row[4], row[5]))

    return offers


def generate_feed(offers: list[LootOffer], docker: bool) -> None:
    last_updated = datetime.now()
    local_timezone = timezone("Europe/Berlin")
    last_updated = last_updated.replace(tzinfo=local_timezone)

    # Generate Feed Info
    # See http://www.atomenabled.org/developers/syndication/#requiredFeedElements
    feed_generator = FeedGenerator()
    # XML
    feed_generator.language("en")
    # Atom Needed
    feed_generator.id("https://phenx.de/loot")
    feed_generator.title("Free Games and Loot Feed - phenx.de")
    feed_generator.updated(last_updated)
    # Atom Recommended
    feed_generator.link(rel="self", href="https://feed.phenx.de/gameloot.xml")
    feed_generator.link(rel="alternate", href="https://phenx.de/loot")
    feed_generator.author(
        {
            "name": "Eiko Wagenknecht",
            "email": "rss@ew-mail.de",
            "uri": "eiko-wagenknecht.de",
        }
    )
    # Atom Optional
    # - Category
    # - Contributor
    # - Generator
    # - Icon
    # - Logo
    # - Rights
    # - Subtitle
    # feed_generator.subtitle('This is a cool feed!')

    entry_id = 1000
    for offer in offers:
        entry_id = entry_id + 1
        feed_entry = feed_generator.add_entry()
        # Atom Needed
        feed_entry.id(str(entry_id))
        feed_entry.title(offer.source + ": " + offer.type + " - " + offer.title)
        feed_generator.updated(last_updated)
        # Atom Recommended
        feed_generator.link()
        # - Author
        # - Content
        # - Link
        # - Summary
        # feed_entry.summary("xxx")
        # Atom Optional
        # - category
        # - contributor
        # - published
        # - source
        # - rights

        feed_entry.content(
            f"""<p>Title: {offer.title}</p>
            <p>Subtitle: {offer.subtitle}</p>
            <p>Publisher: {offer.publisher}</p>
            <p>Valid until: {offer.enddate}</p>
        """,
            type="html",
        )
        # feed_entry.link(href="http://lernfunk.de/feed")

    outputfile = "/data/gameloot.xml" if docker else "data/gameloot.xml"
    feed_generator.atom_file(outputfile)  # Write the ATOM feed to a file


if __name__ == "__main__":
    main()

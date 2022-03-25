import hashlib
import logging
import shutil
import sys
from datetime import datetime, timedelta
from pathlib import Path
from threading import Event
from types import FrameType

from selenium.webdriver.chrome.webdriver import WebDriver

from app.common import TIMESTAMP_LONG, LootOffer, OfferType, Source
from app.configparser import Config
from app.database import LootDatabase
from app.feed import generate_feed
from app.pagedriver import get_pagedriver
from app.scraper.info.steam import get_steam_info
from app.scraper.loot.amazon_prime import AmazonScraper
from app.scraper.loot.epic_games import EpicScraper
from app.scraper.loot.steam import SteamScraper
from app.upload import upload_to_server

exit = Event()


def main() -> None:
    # First thing to do: Copy the config file to the data directory if there is
    # not yet a config file there!
    config_file = Config.config_file()
    if not config_file.is_file():
        print(f"Config file {config_file} not found, creating a new one")
        example_config_file = "config.default.ini"
        config_file.parent.mkdir(exist_ok=True, parents=True)
        shutil.copy(example_config_file, config_file)

    filename = Config.data_path() / Path(Config.config()["common"]["LogFile"])
    loglevel = Config.config()["common"]["Loglevel"]
    logging.basicConfig(
        filename=filename,
        encoding="utf-8",
        level=logging.getLevelName(loglevel),  # type: ignore
        format="%(asctime)s [%(levelname)-5s] %(message)s",
        datefmt=TIMESTAMP_LONG,
    )
    logging.getLogger().addHandler(logging.StreamHandler(sys.stdout))
    logging.info("Starting script")

    # Run the job every hour (or whatever is set in the config file). This is
    # not exact because it does not account for the execution time, but that
    # doesn't matter in our context.
    run = 1
    while not exit.is_set():
        logging.info(f"Starting Run # {run}")
        job()

        time_between_runs = int(Config.config()["common"]["WaitBetweenRuns"])
        if time_between_runs == 0:
            break
        next_execution = datetime.now() + timedelta(seconds=time_between_runs)

        logging.info(f"Waiting until {next_execution.isoformat()} for next execution")

        run += 1
        exit.wait(time_between_runs)

    logging.info(f"Exiting script after {run} runs")


def quit(signo: int, _frame: FrameType | None) -> None:
    print(f"Interrupted by signal {signo}, shutting down")
    exit.set()


def job() -> None:
    db: LootDatabase
    webdriver: WebDriver
    with (LootDatabase() as db, get_pagedriver() as webdriver):
        db.initialize_or_update()
        scraped_offers: dict[str, dict[str, list[LootOffer]]] = {}

        cfg_amazon: bool = Config.config().getboolean("sources_loot", "Amazon")  # type: ignore
        cfg_epic: bool = Config.config().getboolean("sources_loot", "Epic")  # type: ignore
        cfg_steam: bool = Config.config().getboolean("sources_loot", "Steam")  # type: ignore

        cfg_games: bool = Config.config().getboolean("actions", "ScrapeGames")  # type: ignore
        cfg_loot: bool = Config.config().getboolean("actions", "ScrapeLoot")  # type: ignore

        cfg_what_to_scrape = {
            OfferType.GAME.name: cfg_games,
            OfferType.LOOT.name: cfg_loot,
        }
        if cfg_amazon:
            scraped_offers[Source.AMAZON.name] = AmazonScraper.scrape(
                webdriver, cfg_what_to_scrape
            )
        else:
            logging.info(f"Skipping {Source.AMAZON.value}")

        if cfg_epic:
            scraped_offers[Source.EPIC.name] = EpicScraper.scrape(
                webdriver, cfg_what_to_scrape
            )
        else:
            logging.info(f"Skipping {Source.EPIC.value}")

        if cfg_steam:
            scraped_offers[Source.STEAM.name] = SteamScraper.scrape(
                webdriver, cfg_what_to_scrape
            )
        else:
            logging.info(f"Skipping {Source.STEAM.value}")

        # Check which offers are new and which are updated, then act accordingly:
        # - Offers that are neither new nor updated just get a new date
        # - Offers that are new are inserted
        # - Offers that are updated are updated
        db_offers = db.read_offers()
        new_offers: int = 0

        for scraper_source in scraped_offers:
            for scraper_type in scraped_offers[scraper_source]:
                existing_offer_titles = []
                new_offer_titles = []
                for scraper_offer in scraped_offers[scraper_source][scraper_type]:
                    # Check every database entry if this is a match.
                    id = db.find_offers(
                        scraper_offer.source.value,
                        scraper_offer.title,
                        scraper_offer.subtitle,
                        scraper_offer.valid_to,
                    )

                    # Do not insert offers that already have been scraped,
                    # but update their "last seen" date instead
                    if id > 0:
                        scraper_offer.id = id
                        if Config.config().getboolean("expert", "ForceUpdate"):  # type: ignore
                            db.update_offer(scraper_offer)
                        else:
                            db.touch_offer(scraper_offer)

                        # Create a list of all existing offers (logging only)
                        if scraper_offer.title:
                            text = scraper_offer.title
                            if scraper_offer.subtitle:
                                text += ": " + scraper_offer.subtitle
                            existing_offer_titles.append(text)

                        continue

                    # Create a list of new scraped offers (logging only)
                    if scraper_offer.title:
                        text = scraper_offer.title
                        if scraper_offer.subtitle:
                            text += ": " + scraper_offer.subtitle
                        new_offer_titles.append(text)

                    # The enddate has been changed or it is a new offer, get information about it (if it's a game)
                    # and insert it into the database
                    if scraper_offer.title:
                        gameinfo = get_steam_info(webdriver, scraper_offer.title)
                        scraper_offer.gameinfo = gameinfo
                    db.insert_offer(scraper_offer)
                    new_offers += 1

                if len(existing_offer_titles) > 0:
                    logging.info(
                        f'Found existing {scraper_source} {scraper_type} offers: {", ".join(existing_offer_titles)}'
                    )
                if len(new_offer_titles) > 0:
                    logging.info(
                        f'Found new {scraper_source} {scraper_type} offers: {", ".join(new_offer_titles)}'
                    )

        db_offers = db.read_offers()

        # Get Steam game information if ForceUpdate is set
        if Config.config().getboolean("expert", "ForceUpdate"):
            for scraper_source in db_offers:
                for scraper_type in db_offers[scraper_source]:
                    for db_offer in db_offers[scraper_source][scraper_type]:
                        if db_offer.title:
                            gameinfo = get_steam_info(webdriver, db_offer.title)
                            db_offer.gameinfo = gameinfo
                            db.update_offer(db_offer)

    logging.info(f"Found {new_offers} new offers")

    cfg_generate_feed: bool = Config.config().getboolean("actions", "GenerateFeed")  # type: ignore
    cfg_upload: bool = Config.config().getboolean("actions", "UploadFtp")  # type: ignore

    cfg_author_name: str = Config.config()["feed"]["AuthorName"]  # type: ignore
    cfg_author_mail: str = Config.config()["feed"]["AuthorMail"]  # type: ignore
    cfg_author_web: str = Config.config()["feed"]["AuthorWeb"]  # type: ignore
    cfg_feed_url_prefix: str = Config.config()["feed"]["FeedUrlPrefix"]  # type: ignore
    cfg_feed_url_alternate: str = Config.config()["feed"]["FeedUrlAlternate"]  # type: ignore
    cfg_feed_id_prefix: str = Config.config()["feed"]["FeedIdPrefix"]  # type: ignore

    if cfg_generate_feed:
        feed_file_base = Config.data_path() / Path(
            Config.config()["common"]["FeedFilePrefix"] + ".xml"
        )
        # Generate and upload feeds split by source
        any_feed_changed = False
        for scraper_source in db_offers:
            for scraper_type in db_offers[scraper_source]:
                feed_changed = False
                feed_file = Config.data_path() / Path(
                    Config.config()["common"]["FeedFilePrefix"]
                    + f"_{Source[scraper_source].name.lower()}"
                    + f"_{OfferType[scraper_type].name.lower()}"
                    + ".xml"
                )
                old_hash = hash_file(feed_file)
                generate_feed(
                    offers=db_offers[scraper_source][scraper_type],
                    feed_file_base=feed_file_base,
                    author_name=cfg_author_name,
                    author_web=cfg_author_web,
                    author_mail=cfg_author_mail,
                    feed_url_prefix=cfg_feed_url_prefix,
                    feed_url_alternate=cfg_feed_url_alternate,
                    feed_id_prefix=cfg_feed_id_prefix,
                    source=Source[scraper_source],
                    type=OfferType[scraper_type],
                )
                new_hash = hash_file(feed_file)
                if old_hash != new_hash:
                    feed_changed = True
                    any_feed_changed = True

                if feed_changed and cfg_upload:
                    upload_to_server(feed_file)

        # Generate and upload cumulated feed
        all_offers = []
        for scraper_source in db_offers:
            for scraper_type in db_offers[scraper_source]:
                all_offers.extend(db_offers[scraper_source][scraper_type])

        if any_feed_changed:
            generate_feed(
                offers=all_offers,
                feed_file_base=feed_file_base,
                author_name=cfg_author_name,
                author_web=cfg_author_web,
                author_mail=cfg_author_mail,
                feed_url_prefix=cfg_feed_url_prefix,
                feed_url_alternate=cfg_feed_url_alternate,
                feed_id_prefix=cfg_feed_id_prefix,
            )
            if cfg_upload:
                upload_to_server(feed_file_base)
            else:
                logging.info("Skipping upload, disabled")

    else:
        logging.info("Skipping feed generation, disabled")


def log_new_offer(offer: LootOffer) -> None:
    res: str = f"New {offer.type} offer found: {offer.title}"
    if offer.subtitle:
        res += ": " + offer.subtitle
    if offer.valid_to:
        res += " " + offer.valid_to.strftime(TIMESTAMP_LONG)

    logging.info(res)


def hash_file(file: Path) -> str:
    if not file.exists():
        return ""

    hash = hashlib.sha256()

    with open(file, "rb") as f:
        while True:
            data = f.read(65536)
            if not data:
                break
            hash.update(data)

    return hash.hexdigest()


if __name__ == "__main__":
    import signal

    signal.signal(signal.SIGTERM, quit)
    signal.signal(signal.SIGINT, quit)

    main()

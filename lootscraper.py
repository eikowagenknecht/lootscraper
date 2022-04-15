import hashlib
import logging
import shutil
import sys
from datetime import datetime, timedelta
from pathlib import Path
from threading import Event
from types import FrameType

from selenium.webdriver.chrome.webdriver import WebDriver
from sqlalchemy.exc import OperationalError

from app.common import TIMESTAMP_LONG, LootOffer, OfferType, Source
from app.configparser import Config
from app.feed import generate_feed
from app.pagedriver import get_pagedriver
from app.scraper.info.gameinfo import Gameinfo
from app.scraper.info.igdb import get_igdb_details
from app.scraper.info.steam import get_steam_details
from app.scraper.loot.amazon_prime import AmazonScraper
from app.scraper.loot.epic_games import EpicScraper
from app.scraper.loot.gog import GogScraper
from app.scraper.loot.steam import SteamScraper
from app.sqlalchemy import OldDbLoot, OldLootDatabase
from app.upload import upload_to_server

exit = Event()


EXAMPLE_CONFIG_FILE = "config.default.ini"


def main() -> None:
    # First thing to do: Copy the config file to the data directory if there is
    # not yet a config file there!
    config_file = Config.config_file()
    if not config_file.is_file():
        print(f"Config file {config_file} not found, creating a new one")
        config_file.parent.mkdir(exist_ok=True, parents=True)
        shutil.copy(EXAMPLE_CONFIG_FILE, config_file)

    # Now we can try to read the config file. In case anything goes wrong, we
    # terminate because without a valid config continuing is useless.
    try:
        Config.get()
    except KeyError as e:
        print(f"Config could not be loaded, Keys not found: {e.args}")
        sys.exit()

    filename = Config.data_path() / Path(Config.get().log_file)
    loglevel = Config.get().log_level
    logging.basicConfig(
        filename=filename,
        encoding="utf-8",
        level=logging.getLevelName(loglevel),
        format="%(asctime)s %(name)s [%(levelname)-5s] %(message)s",
        datefmt=TIMESTAMP_LONG,
    )
    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(
        logging.Formatter("%(asctime)s %(name)s [%(levelname)-5s] %(message)s")
    )
    logging.getLogger().addHandler(stream_handler)
    logging.info("Starting script")

    # Run the job every hour (or whatever is set in the config file). This is
    # not exact because it does not account for the execution time, but that
    # doesn't matter in our context.
    run = 1
    while not exit.is_set():
        logging.info(f"Starting Run # {run}")

        try:
            job()
        except OperationalError as oe:
            logging.error(f"Database error: {oe}")
            logging.error("Database error, exiting applications")
            sys.exit()
        except Exception as e:
            # Something unexpected occurred, log it and continue with the next run as usual
            logging.exception(e)

        time_between_runs = int(Config.get().wait_between_runs)
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
    db: OldLootDatabase
    webdriver: WebDriver
    with (OldLootDatabase() as db, get_pagedriver() as webdriver):
        scraped_offers: dict[str, dict[str, list[LootOffer]]] = {}

        cfg_what_to_scrape = {
            OfferType.GAME.name: Config.get().scrape_games,
            OfferType.LOOT.name: Config.get().scrape_loot,
        }
        if Config.get().offers_amazon:
            scraped_offers[Source.AMAZON.name] = AmazonScraper.scrape(
                webdriver, cfg_what_to_scrape
            )
        else:
            logging.info(f"Skipping {Source.AMAZON.value}")

        if Config.get().offers_epic:
            scraped_offers[Source.EPIC.name] = EpicScraper.scrape(
                webdriver, cfg_what_to_scrape
            )
        else:
            logging.info(f"Skipping {Source.EPIC.value}")

        if Config.get().offers_steam:
            scraped_offers[Source.STEAM.name] = SteamScraper.scrape(
                webdriver, cfg_what_to_scrape
            )
        else:
            logging.info(f"Skipping {Source.STEAM.value}")

        if Config.get().offers_gog:
            scraped_offers[Source.GOG.name] = GogScraper.scrape(
                webdriver, cfg_what_to_scrape
            )
        else:
            logging.info(f"Skipping {Source.GOG.value}")

        # Check which offers are new and which are updated, then act accordingly:
        # - Offers that are neither new nor updated just get a new date
        # - Offers that are new are inserted
        # - Offers that are updated are updated
        nr_of_new_offers: int = 0

        for scraper_source in scraped_offers:
            for scraper_type in scraped_offers[scraper_source]:
                existing_offer_titles: list[str] = []
                new_offer_titles: list[str] = []
                for scraper_offer in scraped_offers[scraper_source][scraper_type]:
                    # Get the existing entry if there is one
                    existing_entry: OldDbLoot = db.find_offer(
                        scraper_offer.source.value,
                        scraper_offer.title,
                        scraper_offer.subtitle,
                        scraper_offer.valid_to,
                    )

                    # Do not insert offers that already have been scraped,
                    # but update them instead. What gets updated depends on
                    # the settings
                    if existing_entry is not None:
                        if Config.get().force_update:
                            db.update_db_row_with_loot_offer(
                                scraper_offer, existing_entry
                            )
                        else:
                            db.touch_db_row(existing_entry)

                        # Create a list of all existing offers (logging only)
                        if existing_entry.title:
                            text = existing_entry.title
                            if existing_entry.subtitle:
                                text += ": " + existing_entry.subtitle
                            existing_offer_titles.append(text)

                        continue

                    # Create a list of new scraped offers (logging only)
                    if scraper_offer.title:
                        text = scraper_offer.title
                        if scraper_offer.subtitle:
                            text += ": " + scraper_offer.subtitle
                        new_offer_titles.append(text)

                    # The enddate has been changed or it is a new offer,
                    # get information about it (if it's a game)
                    # and insert it into the database
                    add_game_info(webdriver, scraper_offer)
                    db.add_loot_offer(scraper_offer)
                    nr_of_new_offers += 1

                if len(existing_offer_titles) > 0:
                    logging.info(
                        f'Found existing {scraper_source} {scraper_type} offers: {", ".join(existing_offer_titles)}'
                    )
                if len(new_offer_titles) > 0:
                    logging.info(
                        f'Found new {scraper_source} {scraper_type} offers: {", ".join(new_offer_titles)}'
                    )

        loot_offers_in_db = db.read_all_segmented()

        # Get Steam game information if ForceUpdate is set
        if Config.get().force_update:
            for scraper_source in loot_offers_in_db:
                for scraper_type in loot_offers_in_db[scraper_source]:
                    for db_offer in loot_offers_in_db[scraper_source][scraper_type]:
                        add_game_info(webdriver, db_offer)
                        db.update_loot_offer(db_offer)

    logging.info(f"Found {nr_of_new_offers} new offers")

    if Config.get().generate_feed:
        feed_file_base = Config.data_path() / Path(
            Config.get().feed_file_prefix + ".xml"
        )
        # Generate and upload feeds split by source
        any_feed_changed = False
        for scraper_source in loot_offers_in_db:
            for scraper_type in loot_offers_in_db[scraper_source]:
                feed_changed = False
                feed_file = Config.data_path() / Path(
                    Config.get().feed_file_prefix
                    + f"_{Source[scraper_source].name.lower()}"
                    + f"_{OfferType[scraper_type].name.lower()}"
                    + ".xml"
                )
                old_hash = hash_file(feed_file)
                generate_feed(
                    offers=loot_offers_in_db[scraper_source][scraper_type],
                    feed_file_base=feed_file_base,
                    author_name=Config.get().feed_author_name,
                    author_web=Config.get().feed_author_web,
                    author_mail=Config.get().feed_author_mail,
                    feed_url_prefix=Config.get().feed_url_prefix,
                    feed_url_alternate=Config.get().feed_url_alternate,
                    feed_id_prefix=Config.get().feed_id_prefix,
                    source=Source[scraper_source],
                    type=OfferType[scraper_type],
                )
                new_hash = hash_file(feed_file)
                if old_hash != new_hash:
                    feed_changed = True
                    any_feed_changed = True

                if feed_changed and Config.get().upload_feed:
                    upload_to_server(feed_file)

        # Generate and upload cumulated feed
        all_offers = []
        for scraper_source in loot_offers_in_db:
            for scraper_type in loot_offers_in_db[scraper_source]:
                all_offers.extend(loot_offers_in_db[scraper_source][scraper_type])

        if any_feed_changed:
            generate_feed(
                offers=all_offers,
                feed_file_base=feed_file_base,
                author_name=Config.get().feed_author_name,
                author_web=Config.get().feed_author_web,
                author_mail=Config.get().feed_author_mail,
                feed_url_prefix=Config.get().feed_url_prefix,
                feed_url_alternate=Config.get().feed_url_alternate,
                feed_id_prefix=Config.get().feed_id_prefix,
            )
            if Config.get().upload_feed:
                upload_to_server(feed_file_base)
            else:
                logging.info("Skipping upload, disabled")

    else:
        logging.info("Skipping feed generation, disabled")


def add_game_info(webdriver: WebDriver, scraper_offer: LootOffer) -> None:

    if scraper_offer.title and (Config.get().info_igdb or Config.get().info_steam):
        gameinfo: Gameinfo | None = Gameinfo()
        if Config.get().info_igdb:
            gameinfo = get_igdb_details(scraper_offer.title)
        if Config.get().info_steam:
            gameinfo_steam = get_steam_details(webdriver, scraper_offer.title)
            scraper_offer.gameinfo = Gameinfo.merge(gameinfo, gameinfo_steam)


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

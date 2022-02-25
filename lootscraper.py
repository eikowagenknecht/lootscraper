import hashlib
import logging
import shutil
import sys
from datetime import datetime, timedelta
from pathlib import Path
from threading import Event
from types import FrameType

from app.common import TIMESTAMP_LONG, LootOffer, Source, get_shortname, get_source
from app.configparser import Config
from app.database import LootDatabase
from app.feed import generate_feed
from app.scraper.amazon_prime import AmazonScraper
from app.scraper.epic_games import EpicScraper
from app.upload import upload_to_server

exit = Event()


def main() -> None:
    # First thing to do: Copy the config file to the data directory if there is
    # not yet a config file there!
    config_file = Config.config_file()
    if not config_file.exists():
        print(f"Config file {config_file} not found, creating a new one")
        example_config_file = "config.default.ini"
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
    with LootDatabase() as db:
        db.initialize_or_update()
        scraped_offers: dict[str, list[LootOffer]] = {}

        cfg_amazon_games: bool = Config.config().getboolean("actions", "ScrapeAmazonGames")  # type: ignore
        cfg_amazon_loot: bool = Config.config().getboolean("actions", "ScrapeAmazonLoot")  # type: ignore

        if cfg_amazon_games or cfg_amazon_loot:
            scraped_offers[Source.AMAZON.name] = AmazonScraper.scrape(
                {
                    "games": cfg_amazon_games,
                    "loot": cfg_amazon_loot,
                }
            )
        else:
            logging.info("Skipping Amazon")

        cfg_epic: bool = Config.config().getboolean("actions", "ScrapeEpicGames")  # type: ignore
        if cfg_epic:
            scraped_offers[Source.EPIC.name] = EpicScraper.scrape()
        else:
            logging.info("Skipping Epic")

        # Check which offers are new and which are updated, then act accordingly:
        # - Offers that are neither new nor updated just get a new date
        # - Offers that are new are inserted
        # - Offers that are updated are updated
        db_offers = db.read_offers()
        new_offers: int = 0

        for scraper in scraped_offers:
            for source_offer in scraped_offers[scraper]:
                exists_in_db = False
                # Check every database entry if this is a match.
                # TODO: Could probably made much faster using SQL, but irrelevant for now.
                for db_offer in db_offers[scraper]:
                    if db_offer.source != source_offer.source:
                        continue
                    if db_offer.title != source_offer.title:
                        continue
                    if db_offer.subtitle != source_offer.subtitle:
                        continue
                    if db_offer.valid_to != source_offer.valid_to:
                        continue

                    # Offer has already been scraped, so do not insert this into the database, but update the "last seen" timestamp
                    source_offer.id = db_offer.id
                    if Config.config().getboolean("common", "ForceUpdate"):  # type: ignore
                        db.update_offer(source_offer)
                    else:
                        db.touch_offer(source_offer)
                    exists_in_db = True
                    break

                if not exists_in_db:
                    # The enddate has been changed or it is a new offer, insert it into the database
                    db.insert_offer(source_offer)
                    new_offers += 1

        db_offers = db.read_offers()

    logging.info(f"Found {new_offers} new offers")

    cfg_generate_feed: bool = Config.config().getboolean("actions", "GenerateFeed")  # type: ignore
    cfg_upload: bool = Config.config().getboolean("actions", "UploadFtp")  # type: ignore

    if cfg_generate_feed:
        # Generate and upload feeds split by source
        any_feed_changed = False
        for scraper in db_offers:
            feed_changed = False
            feed_file = Config.data_path() / Path(
                Config.config()["common"]["FeedFilePrefix"]
                + "_"
                + get_shortname(get_source(scraper))
                + ".xml"
            )
            old_hash = hash_file(feed_file)
            generate_feed(db_offers[scraper], feed_file)
            new_hash = hash_file(feed_file)
            if old_hash != new_hash:
                feed_changed = True
                any_feed_changed = True

            if feed_changed and cfg_upload:
                upload_to_server(feed_file)

        # Generate and upload cumulated feed
        all_offers = []
        for scraper in db_offers:
            all_offers.extend(db_offers[scraper])

        if any_feed_changed:
            feed_file = Config.data_path() / Path(
                Config.config()["common"]["FeedFilePrefix"] + ".xml"
            )
            generate_feed(all_offers, feed_file)
            if cfg_upload:
                upload_to_server(feed_file)
            else:
                logging.info("Skipping upload")

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

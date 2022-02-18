import logging
import sys
from threading import Event
from datetime import datetime, timedelta
from pathlib import Path
from types import FrameType

from app.common import TIMESTAMP_LONG, LootOffer
from app.config.config import DATA_PATH, LOG_FILE, LOGLEVEL, WAIT_BETWEEN_RUNS
from app.database import LootDatabase
from app.feed import generate_feed
from app.scraper.amazon_prime import AmazonScraper
from app.upload import upload_to_server


exit = Event()


def main() -> None:
    logging.basicConfig(
        filename=Path(DATA_PATH) / Path(LOG_FILE),
        encoding="utf-8",
        level=LOGLEVEL,
        format="%(asctime)s [%(levelname)-5s] %(message)s",
        datefmt=TIMESTAMP_LONG,
    )
    logging.getLogger().addHandler(logging.StreamHandler(sys.stdout))
    logging.info("Starting script")

    # Run the job every hour. Yes, this is not exact because it does not
    # account for the execution time, but that doesn't matter in our context.
    while not exit.is_set():
        logging.info("Starting Job")
        job()

        next_execution = datetime.now() + timedelta(seconds=WAIT_BETWEEN_RUNS)

        logging.info(
            f"Waiting until {next_execution.strftime(TIMESTAMP_LONG)} for next execution"
        )

        exit.wait(WAIT_BETWEEN_RUNS)

    logging.info("Exiting script")


def quit(signo: int, _frame: FrameType | None) -> None:
    print(f"Interrupted by signal {signo}, shutting down")
    exit.set()


def job() -> None:
    db: LootDatabase
    with LootDatabase() as db:
        db.create_tables()
        amazon_offers = AmazonScraper.scrape()

        # Check which offers are new and which are updated, then act accordingly:
        # - Offers that are neither new nor updated just get a new date
        # - Offers that are new are inserted
        # - Offers that are updated are updated
        db_offers = db.read_offers()
        new_offers: int = 0

        for scraped_offer in amazon_offers:
            exists_in_db = False
            # Check every database entry if this is a match. Could probably made much faster, but irrelevant for now.
            for db_offer in db_offers:
                if (
                    db_offer.source == scraped_offer.source
                    and db_offer.title == scraped_offer.title
                    and db_offer.subtitle == scraped_offer.subtitle
                    and db_offer.enddate == scraped_offer.enddate
                ):
                    # Offer has already been scraped, so do not insert this into the database, but update the "last seen" timestamp
                    scraped_offer.id = db_offer.id
                    # db.update_url(scraped_offer)
                    db.touch_offer(scraped_offer)
                    exists_in_db = True
                    break

            if not exists_in_db:
                # The enddate has been changed or it is a new offer, insert it into the database
                db.insert_offer(scraped_offer)
                new_offers += 1

        all_offers = db.read_offers()

    logging.info("Found {new_offers} new offers")
    if new_offers:
        generate_feed(all_offers)
        upload_to_server()
    else:
        logging.info("Skipping feed generation and upload")


def log_new_offer(offer: LootOffer) -> None:
    res: str = f"New {offer.type} offer found: {offer.title}"
    if offer.subtitle:
        res += ": " + offer.subtitle
    if offer.enddate:
        res += " " + offer.enddate

    logging.info(res)


if __name__ == "__main__":
    import signal

    signal.signal(signal.SIGTERM, quit)
    signal.signal(signal.SIGINT, quit)

    main()

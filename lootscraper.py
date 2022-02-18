import logging
import sys
from datetime import datetime, timedelta
from pathlib import Path
from time import sleep

from app.common import TIMESTAMP_LONG, LootOffer
from app.config.config import DATA_PATH, LOG_FILE, LOGLEVEL, WAIT_BETWEEN_RUNS
from app.database import LootDatabase
from app.feed import generate_feed
from app.scraper.amazon_prime import AmazonScraper
from app.upload import upload_to_server


def main() -> None:
    logging.basicConfig(
        filename=Path(DATA_PATH) / Path(LOG_FILE),
        encoding="utf-8",
        level=LOGLEVEL,
        format="%(asctime)s [%(levelname)-5s] %(message)s",
        datefmt=TIMESTAMP_LONG,
    )
    logging.getLogger().addHandler(logging.StreamHandler(sys.stdout))
    logging.info("Script started")

    # Run the job every hour. Yes, this is not exact because it does not
    # account for the execution time, but that doesn't matter in our context.
    while True:
        logging.info("Starting Job")
        job()

        next_execution = datetime.now() + timedelta(seconds=WAIT_BETWEEN_RUNS)

        logging.info(
            f"Waiting until {next_execution.strftime(TIMESTAMP_LONG)} for next execution"
        )

        # Sleep in 1 second cycles so for interrupts can terminate the thread
        for i in range(WAIT_BETWEEN_RUNS):
            sleep(1)


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

        all_offers = db.read_offers()

    log_offers(all_offers)
    generate_feed(all_offers)
    upload_to_server()


def log_offers(all_offers: list[LootOffer]) -> None:
    logging.info("Offers currently in database:")
    for offer in all_offers:
        logging.info(
            f"{offer.type}: {offer.title} || {offer.subtitle} || {offer.enddate}"
        )


if __name__ == "__main__":
    main()

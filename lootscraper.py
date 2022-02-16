import sys
from argparse import ArgumentParser
from pathlib import Path
from time import sleep

import schedule
from typed_argparse import TypedArgs

from app.common import LootOffer
from app.database import LootDatabase
from app.feed import generate_feed
from app.scraper.amazon_prime import AmazonScraper
from app.upload import upload_to_server


class Arguments(TypedArgs):
    docker: bool


def main() -> None:
    args = parse_commandline_arguments()

    schedule.every().hour.do(job, args=args)  # type: ignore

    while True:
        schedule.run_pending()  # type: ignore
        sleep(1)


def job(args: Arguments) -> None:
    data_path = Path("/data/") if args.docker else Path("data/")

    db: LootDatabase
    with LootDatabase(data_path) as db:
        db.create_tables()
        amazon_offers = AmazonScraper.scrape(args.docker)

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

        new_offers = db.read_offers()

    debug_print_offers(new_offers)
    generate_feed(new_offers, data_path)
    upload_to_server(data_path)


def debug_print_offers(all_offers: list[LootOffer]) -> None:
    for offer in all_offers:
        print(f"{offer.type}: {offer.title} || {offer.subtitle} || {offer.enddate}")


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


if __name__ == "__main__":
    main()

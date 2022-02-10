import sys
from argparse import ArgumentParser
from pathlib import Path

from typed_argparse import TypedArgs

from app.common import LootOffer
from app.database import LootDatabase
from app.feed import generate_feed
from app.scraper.amazon_prime import AmazonScraper


class Arguments(TypedArgs):
    docker: bool


def main() -> None:
    args = parse_commandline_arguments()

    db_path = Path("/data/") if args.docker else Path("data/")

    db: LootDatabase
    with LootDatabase(db_path) as db:
        db.create_tables()
        amazon_offers = AmazonScraper.scrape(args.docker)
        db.insert_offers(amazon_offers)

        # Check which offers are new and which are updated, then act accordingly:
        # - Offers that are neither new nor updated just get a new date
        # - Offers that are new are inserted
        # - Offers that are updated are updated
        all_offers = db.read_offers()

    debug_print_offers(all_offers)
    generate_feed(all_offers, args.docker)


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

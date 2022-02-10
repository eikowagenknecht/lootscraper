import sys
from argparse import ArgumentParser

from typed_argparse import TypedArgs

from app.database import insert_offers, prepare_database, read_offers, terminate_connection
from app.common import LootOffer
from app.feed import generate_feed
from app.scraper.amazon_prime import AmazonScraper


class Arguments(TypedArgs):
    docker: bool


def main() -> None:
    args = parse_commandline_arguments()
    amazon_offers = AmazonScraper.scrape(args.docker)
    database = prepare_database(args.docker)
    insert_offers(database, amazon_offers)
    all_offers = read_offers(database)
    terminate_connection(database)
    debug_print_offers(all_offers)
    generate_feed(all_offers, args.docker)


def debug_print_offers(all_offers: list[LootOffer]) -> None:
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

import hashlib
import logging
import shutil
import sys
from contextlib import nullcontext
from datetime import datetime, timedelta
from pathlib import Path
from threading import Event
from types import FrameType

from selenium.webdriver.chrome.webdriver import WebDriver
from sqlalchemy import select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.common import TIMESTAMP_LONG, OfferType, Source
from app.configparser import Config
from app.feed import generate_feed
from app.pagedriver import get_pagedriver
from app.scraper.info.igdb import get_igdb_details, get_igdb_id
from app.scraper.info.steam import get_steam_details, get_steam_id
from app.scraper.loot.amazon_prime import AmazonScraper
from app.scraper.loot.epic_games import EpicScraper
from app.scraper.loot.gog import GogScraper
from app.scraper.loot.steam import SteamScraper
from app.sqlalchemy import Game, LootDatabase, Offer, User
from app.telegram import TelegramBot
from app.upload import upload_to_server

exit = Event()


CURRENT_VERSION = "0.3.4"
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
    logging.info(f"Starting LootScraper v{CURRENT_VERSION}")

    if Config.get().virtual_linux_display:
        from xvfbwrapper import Xvfb

        vdisplay = Xvfb()
        vdisplay.start()

    with (
        LootDatabase(echo=Config.get().db_echo) as db,
        TelegramBot(Config.get(), db.Session) as bot,
        Xvfb() if Config.get().virtual_linux_display else nullcontext(),
    ):
        # Run the job every hour (or whatever is set in the config file). This is
        # not exact because it does not account for the execution time, but that
        # doesn't matter in our context.
        run = 1
        while not exit.is_set():
            logging.info(f"Starting Run # {run}")

            try:
                job(db)
                if Config.get().telegram_bot:
                    session: Session = db.Session()
                    for user in session.execute(select(User)).scalars().all():
                        bot.send_new_announcements(user)
                        bot.send_new_offers(user)
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

            logging.info(
                f"Waiting until {next_execution.isoformat()} for next execution"
            )

            run += 1
            exit.wait(time_between_runs)

    if Config.get().virtual_linux_display:
        vdisplay.stop()

    logging.info(f"Exiting script after {run} runs")


def quit(signo: int, _frame: FrameType | None) -> None:
    print(f"Interrupted by signal {signo}, shutting down")
    exit.set()


def job(db: LootDatabase) -> None:
    webdriver: WebDriver
    session: Session = db.Session()
    with get_pagedriver() as webdriver:
        scraped_offers: dict[str, dict[str, list[Offer]]] = {}

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
                    existing_entry: Offer | None = db.find_offer(
                        scraper_offer.source,
                        scraper_offer.type,
                        scraper_offer.title,
                        scraper_offer.valid_to,
                    )

                    # Do not insert offers that already have been scraped,
                    # but update them instead. What gets updated depends on
                    # the settings
                    if existing_entry is not None:
                        if Config.get().force_update:
                            db.update_db_offer(existing_entry, scraper_offer)
                        else:
                            db.touch_db_offer(existing_entry)

                        # Create a list of all existing offers (logging only)
                        if existing_entry.title:
                            text = existing_entry.title
                            existing_offer_titles.append(text)

                        continue

                    # Create a list of new scraped offers (logging only)
                    if scraper_offer.title:
                        text = scraper_offer.title
                        new_offer_titles.append(text)

                    # The enddate has been changed or it is a new offer,
                    # get information about it (if it's a game)
                    # and insert it into the database
                    if Config.get().scrape_info:
                        add_game_info(scraper_offer, session, webdriver)
                    db.add_offer(scraper_offer)
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

        logging.info(f"Found {nr_of_new_offers} new offers")

        # Refresh game information if ForceUpdate is set
        if Config.get().force_update and Config.get().scrape_info:
            # Remove all game info first
            logging.info("Force update enabled - removing all game info")
            for game in session.query(Game):
                session.delete(game)
            # Then add new game info
            for scraper_source in loot_offers_in_db:
                for scraper_type in loot_offers_in_db[scraper_source]:
                    for db_offer in loot_offers_in_db[scraper_source][scraper_type]:
                        add_game_info(db_offer, session, webdriver)

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

    session.commit()


def add_game_info(offer: Offer, session: Session, webdriver: WebDriver) -> None:
    """Updated an offer with game information. If the offer already has some
    information, just try to update the missing parts. Otherwise, create a new
    Game and try to populate it with information."""

    if offer.game:
        # The offer already has a game attached, leave it alone
        return

    # Offer hast no game name, so we can't add any game related information
    if offer.probable_game_name is None:
        logging.warning(f"Offer {offer} has no game name")
        return

    existing_game: Game | None = None

    # Offer has a name but no game, try to find a matching entry in our game
    # database (prioritize IGDB)
    igdb_id = get_igdb_id(offer.probable_game_name)

    if igdb_id is not None:
        existing_game = (
            session.execute(select(Game).where(Game.igdb_id == igdb_id))
            .scalars()
            .one_or_none()
        )

    if existing_game:
        offer.game = existing_game
        return

    # No IGDB match, try to find a matching entry via Steam
    steam_id = get_steam_id(offer.probable_game_name, driver=webdriver)
    if steam_id is not None:
        existing_game = (
            session.execute(select(Game).where(Game.steam_id == steam_id))
            .scalars()
            .one_or_none()
        )

    if existing_game:
        offer.game = existing_game
        return

    # Ok, we still got no match in our own database
    if steam_id is None and igdb_id is None:
        # No game found, nothing further to do
        return

    # We have some new match. Create a new game and attach it to the offer
    offer.game = Game()
    if igdb_id:
        offer.game.igdb_info = get_igdb_details(id=igdb_id)
    if steam_id:
        offer.game.steam_info = get_steam_details(id=steam_id, driver=webdriver)


def log_new_offer(offer: Offer) -> None:
    res: str = f"New {offer.type} offer found: {offer.title}"
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

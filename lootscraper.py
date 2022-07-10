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

from app.common import TIMESTAMP_LONG, OfferDuration, OfferType, Source
from app.configparser import Config
from app.feed import generate_feed
from app.pagedriver import get_pagedriver
from app.scraper.info.igdb import get_igdb_details, get_igdb_id
from app.scraper.info.steam import get_steam_details, get_steam_id
from app.scraper.loot.scraperhelper import get_all_scrapers
from app.sqlalchemy import Game, IgdbInfo, LootDatabase, Offer, SteamInfo, User
from app.telegram import TelegramBot
from app.upload import upload_to_server

exit = Event()


CURRENT_VERSION = "0.4.4"
EXAMPLE_CONFIG_FILE = "config.default.ini"


def main() -> None:
    initialize_config_file()
    check_config_file()
    setup_logging()

    logging.info(f"Starting LootScraper v{CURRENT_VERSION}")
    run_main_loop()
    logging.info(f"Exiting LootScraper v{CURRENT_VERSION}")


def initialize_config_file() -> None:
    """
    Copy the config file to the data directory if there is not yet a config file there!
    """
    config_file = Config.config_file()
    if not config_file.is_file():
        create_config_file(config_file)


def create_config_file(config_file: Path) -> None:
    print(f"Config file {config_file} not found, creating a new one")
    config_file.parent.mkdir(exist_ok=True, parents=True)
    shutil.copy(EXAMPLE_CONFIG_FILE, config_file)


def check_config_file() -> None:
    # Now we can try to read the config file. In case anything goes wrong, we
    # terminate because without a valid config continuing is useless.
    try:
        Config.get()
    except KeyError as e:
        print(f"Config could not be loaded, Keys not found: {e.args}")
        sys.exit()


def setup_logging() -> None:
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


def run_main_loop() -> None:
    """
    Run the job every hour (or whatever is set in the config file). This is
    not exact because it does not account for the execution time, but that
    doesn't matter in our context.
    """
    if Config.get().virtual_linux_display:
        from xvfbwrapper import Xvfb

    with (
        LootDatabase(echo=Config.get().db_echo) as db,
        TelegramBot(Config.get(), db.Session) as bot,
        Xvfb() if Config.get().virtual_linux_display else nullcontext(),
    ):

        run = 1
        time_between_runs = int(Config.get().wait_between_runs)

        while not exit.is_set():
            logging.info(f"Starting Run # {run}")

            try:
                job(db)
                if Config.get().telegram_bot:
                    telegram_job(db, bot)
            except OperationalError as oe:
                logging.error(f"Database error: {oe}")
                logging.error("Database error, exiting applications")
                sys.exit()
            except Exception as e:
                # Something unexpected occurred, log it and continue with the next run as usual
                logging.exception(e)

            if time_between_runs == 0:
                break

            next_execution = datetime.now() + timedelta(seconds=time_between_runs)

            logging.info(
                f"Waiting until {next_execution.isoformat()} for next execution"
            )

            run += 1
            exit.wait(time_between_runs)

        logging.info(f"Finished {run} runs")


def job(db: LootDatabase) -> None:
    webdriver: WebDriver
    session: Session = db.Session()
    cfg = Config.get()

    with get_pagedriver() as webdriver:
        scraped_offers = scrape_offers(webdriver)
        process_new_offers(db, webdriver, session, scraped_offers)

        all_offers = db.read_all()

        if cfg.force_update and cfg.scrape_info:
            rebuild_game_infos(webdriver, session, all_offers)

    if cfg.generate_feed:
        action_generate_feed(all_offers)
    else:
        logging.info("Skipping feed generation, disabled")

    session.commit()


def scrape_offers(webdriver: WebDriver) -> list[Offer]:
    cfg = Config.get()

    scraped_offers: list[Offer] = []
    for scraper in get_all_scrapers():
        if (
            scraper.get_type() in cfg.enabled_offer_types
            and scraper.get_duration() in cfg.enabled_offer_durations
            and scraper.get_source() in cfg.enabled_offer_sources
        ):
            scraper_type = scraper.get_type().value
            scraper_duration = scraper.get_duration().value
            scraper_source = scraper.get_source().value

            logging.info(
                f"Analyzing {scraper_source} for offers: {scraper_type} / {scraper_duration}."
            )
            scraper_results = scraper.scrape(webdriver)

            if scraper_results:
                titles = ", ".join([offer.title for offer in scraper_results])
                logging.info(f"Found {len(scraper_results)} offers: {titles}.")
                scraped_offers.extend(scraper_results)
            else:
                logging.warning("Scraper finished without results.")

    return scraped_offers


def process_new_offers(
    db: LootDatabase,
    webdriver: WebDriver,
    session: Session,
    scraped_offers: list[Offer],
) -> None:
    """
    Check which offers are new and which are updated, then act accordingly:
     - Offers that are neither new nor updated just get a new date
     - Offers that are new are inserted
     - Offers that are updated are updated
    """

    cfg = Config.get()

    nr_of_new_offers: int = 0
    new_offer_titles: list[str] = []

    for scraped_offer in scraped_offers:
        # Get the existing entry if there is one
        existing_entry: Offer | None = db.find_offer(
            scraped_offer.source,
            scraped_offer.type,
            scraped_offer.title,
            scraped_offer.valid_to,
        )

        if not existing_entry:
            # Create a list of new scraped offers (logging only)
            if scraped_offer.title:
                new_offer_titles.append(scraped_offer.title)

                # The enddate has been changed or it is a new offer,
                # get information about it (if it's a game)
                # and insert it into the database
            if cfg.scrape_info:
                add_game_info(scraped_offer, session, webdriver)
            db.add_offer(scraped_offer)
            nr_of_new_offers += 1
        else:
            # Do not insert offers that already have been scraped,
            # but update them instead. What gets updated depends on
            # the settings
            if cfg.force_update:
                db.update_db_offer(existing_entry, scraped_offer)
            else:
                db.touch_db_offer(existing_entry)

    if new_offer_titles:
        logging.info(
            f'Found {nr_of_new_offers} new offers: {", ".join(new_offer_titles)}'
        )


def telegram_job(db: LootDatabase, bot: TelegramBot) -> None:
    session: Session = db.Session()
    for user in session.execute(select(User)).scalars().all():
        bot.send_new_announcements(user)
        bot.send_new_offers(user)


def rebuild_game_infos(
    webdriver: WebDriver, session: Session, all_offers: list[Offer]
) -> None:
    # Remove all game info first
    logging.info("Force update enabled - removing all game info")
    for game in session.query(Game):
        session.delete(game)

    # Then add new game info
    for db_offer in all_offers:
        add_game_info(db_offer, session, webdriver)


def action_generate_feed(loot_offers_in_db: list[Offer]) -> None:
    cfg = Config.get()
    feed_file_base = Config.data_path() / Path(cfg.feed_file_prefix + ".xml")

    any_feed_changed = False

    source: Source
    type_: OfferType
    duration: OfferDuration

    # Generate and upload feeds split by source
    for source, type_, duration in [
        (x.get_source(), x.get_type(), x.get_duration()) for x in get_all_scrapers()
    ]:
        offers = [
            offer
            for offer in loot_offers_in_db
            if offer.source == source
            and offer.type == type_
            and offer.duration == duration
        ]
        if not offers:
            continue

        feed_changed = False
        feed_file_core = f"_{source.name.lower()}" + f"_{type_.name.lower()}"

        # To keep the old feed ids and names only add when the type is one of
        # the new types.
        if duration != OfferDuration.CLAIMABLE:
            feed_file_core += f"_{duration.name.lower()}"

        feed_file = Config.data_path() / Path(
            cfg.feed_file_prefix + feed_file_core + ".xml"
        )
        old_hash = hash_file(feed_file)
        generate_feed(
            offers=offers,
            file=feed_file,
            author_name=cfg.feed_author_name,
            author_web=cfg.feed_author_web,
            author_mail=cfg.feed_author_mail,
            feed_url_prefix=cfg.feed_url_prefix,
            feed_url_alternate=cfg.feed_url_alternate,
            feed_id_prefix=cfg.feed_id_prefix,
            source=source,
            type=type_,
            duration=duration,
        )
        new_hash = hash_file(feed_file)
        if old_hash != new_hash:
            feed_changed = True
            any_feed_changed = True

        if feed_changed and cfg.upload_feed:
            upload_to_server(feed_file)

    # Generate and upload cumulated feed
    if any_feed_changed:
        feed_file = Config.data_path() / Path(cfg.feed_file_prefix + ".xml")
        generate_feed(
            offers=loot_offers_in_db,
            file=feed_file,
            author_name=cfg.feed_author_name,
            author_web=cfg.feed_author_web,
            author_mail=cfg.feed_author_mail,
            feed_url_prefix=cfg.feed_url_prefix,
            feed_url_alternate=cfg.feed_url_alternate,
            feed_id_prefix=cfg.feed_id_prefix,
        )
        if cfg.upload_feed:
            upload_to_server(feed_file_base)
        else:
            logging.info("Skipping upload, disabled")


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

    # Offer has a name but no game. Try to find a matching entry in our local
    # database first (prioritize IGDB)
    igdb_id = (
        session.execute(
            select(IgdbInfo.id).where(IgdbInfo.name == offer.probable_game_name)
        )
        .scalars()
        .one_or_none()
    )

    # Use the api if no local entry exists
    if igdb_id is None:
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
    steam_id = (
        session.execute(
            select(SteamInfo.id).where(SteamInfo.name == offer.probable_game_name)
        )
        .scalars()
        .one_or_none()
    )

    # Use the api if no local entry exists
    if steam_id is None:
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


def quit(signo: int, _frame: FrameType | None) -> None:
    print(f"Interrupted by signal {signo}, shutting down")
    exit.set()


if __name__ == "__main__":
    import signal

    signal.signal(signal.SIGTERM, quit)
    signal.signal(signal.SIGINT, quit)

    main()

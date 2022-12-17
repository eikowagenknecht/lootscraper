__version__ = "1.0.0"
__author__ = "Eiko Wagenknecht"

import asyncio
import hashlib
import logging
import shutil
import sys
from contextlib import ExitStack
from datetime import datetime, timedelta
from logging.handlers import RotatingFileHandler
from pathlib import Path

from playwright.async_api import BrowserContext
from sqlalchemy import select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.common import TIMESTAMP_LONG, OfferDuration, OfferType, Source
from app.configparser import Config
from app.feed import generate_feed
from app.pagedriver import get_browser_context
from app.scraper.info.igdb import get_igdb_details, get_igdb_id
from app.scraper.info.steam import get_steam_details, get_steam_id
from app.scraper.loot.scraperhelper import get_all_scrapers
from app.sqlalchemy import Game, IgdbInfo, LootDatabase, Offer, SteamInfo, User
from app.telegram import TelegramBot
from app.upload import upload_to_server

try:
    from xvfbwrapper import Xvfb

    # Logging not initialized yet, so we print to stdout
    print("Using virtual display")
    use_virtual_display = True
except ImportError:
    print("Using real display")
    use_virtual_display = False


EXAMPLE_CONFIG_FILE = "config.default.ini"

# TODO:
# - Switch from synchronous selenium to asynchronous framework,
#   e.g. playwright (or if that doesn't work pyppeeter).
#   This should allow us to still respond to Telegram messages while
#   scraping is running.
# - Switch from synchronous database access to asynchronous
# - Look for TODOs in the code
# - Check all warnings and errors in the code
# - Add code coverage and way more tests (plus a mocking framework?)
# - Check why log files are only 10KB


async def main() -> None:
    # Synchronously set up the basics we need to run anything
    initialize_config_file()
    check_config_file()
    setup_logging()

    logging.info(f"Starting LootScraper v{__version__}")

    # Run the various parts of the bot asynchronously (so we don't block)
    # and communicate using a queue.
    telegram_queue: asyncio.Queue[int] = asyncio.Queue()

    try:
        with LootDatabase(echo=Config.get().db_echo) as db:
            async with asyncio.TaskGroup() as tg:  # type: ignore
                tg.create_task(run_scraper_loop(db, telegram_queue))
                if Config.get().telegram_bot:
                    tg.create_task(run_telegram_bot(db, telegram_queue))
    except OperationalError as db_error:
        logging.error(f"Database error, exiting application: {db_error}")
        sys.exit()

    logging.info(f"Exiting LootScraper v{__version__}")


def initialize_config_file() -> None:
    """
    Copy the config file to the data directory if there is not yet a config file there!
    """
    config_file = Config.config_file()
    if not config_file.is_file():
        create_config_file(config_file)


def create_config_file(config_file: Path) -> None:
    """
    Create a new config file from the example config file.
    """
    print(f"Config file {config_file} not found, creating a new one")
    config_file.parent.mkdir(exist_ok=True, parents=True)
    shutil.copy(EXAMPLE_CONFIG_FILE, config_file)


def check_config_file() -> None:
    """
    Check if the config file is valid and can be read.
    """
    # Now we can try to read the config file. In case anything goes wrong, we
    # terminate because without a valid config continuing is useless.
    try:
        Config.get()
    except KeyError as e:
        print(f"Config could not be loaded, Keys not found: {e.args}")
        sys.exit()


def setup_logging() -> None:
    """
    Set up the logging system.
    """
    filename = Config.data_path() / Path(Config.get().log_file)
    loglevel = Config.get().log_level
    logging.basicConfig(
        handlers=[
            RotatingFileHandler(filename, maxBytes=10 * 1024 ^ 2, backupCount=10),
            get_streamhandler(),
        ],
        encoding="utf-8",
        level=logging.getLevelName(loglevel),
        format="%(asctime)s %(name)s [%(levelname)-5s] %(message)s",
        datefmt=TIMESTAMP_LONG,
    )


def get_streamhandler() -> logging.StreamHandler:  # type: ignore
    """
    Get a handler handler for the console output.
    """
    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(
        logging.Formatter("%(asctime)s %(name)s [%(levelname)-5s] %(message)s")
    )
    return stream_handler


async def run_telegram_bot(
    db: LootDatabase,
    queue: asyncio.Queue[int],
) -> None:
    """
    Run the Telegram bot and send new offers when there is a new entry in the
    queue.
    """
    async with TelegramBot(Config.get(), db.Session) as bot:
        # The bot is running now and will stop when the context exits
        while True:
            run = await queue.get()
            logging.info(
                f"Sending offers on Telegram that were found in scraping run #{run}."
            )

            try:
                await send_new_offers_telegram(db, bot)
            except OperationalError:
                # We handle DB errors on a higher level
                raise
            except Exception as e:  # pylint: disable=broad-except
                # This is our catch-all. Something really unexpected occurred.
                # Log it with the highest priority and continue with the
                # next run.
                logging.critical(e)

            queue.task_done()


async def run_scraper_loop(
    db: LootDatabase,
    telegram_queue: asyncio.Queue[int],
) -> None:
    """
    Run the scraping job in a loop with a waiting time of x seconds (set in the
    config file) between the runs.
    """
    with ExitStack() as stack:
        # Check the "global" variable (set on import) to see if we can use a virtual display
        if use_virtual_display:
            stack.enter_context(Xvfb())

        time_between_runs = int(Config.get().wait_between_runs)

        # Loop forever (until terminated by external events)
        run = 0
        while True:
            run += 1

            logging.info(f"Starting scraping run #{run}.")

            try:
                await scrape_new_offers(db)
            except OperationalError:
                # We handle DB errors on a higher level
                raise
            except Exception as e:  # pylint: disable=broad-except
                # This is our catch-all. Something really unexpected occurred.
                # Log it with the highest priority and continue with the
                # next run.
                logging.critical(e)

            if time_between_runs == 0:
                break

            next_execution = datetime.now() + timedelta(seconds=time_between_runs)

            logging.info(f"Next scraping run will be at {next_execution.isoformat()}.")

            if Config.get().telegram_bot:
                await telegram_queue.put(run)

            await asyncio.sleep(time_between_runs)

        logging.info(f"Finished {run} runs")


async def scrape_new_offers(db: LootDatabase) -> None:
    """
    Do the actual scraping and processing of new offers.
    """
    webdriver: BrowserContext
    cfg = Config.get()

    async with get_browser_context() as webdriver:
        session: Session = db.Session()
        try:
            scraped_offers = await scrape_offers(webdriver)
            await process_new_offers(db, webdriver, session, scraped_offers)

            all_offers = db.read_all()

            if cfg.force_update and cfg.scrape_info:
                await rebuild_game_infos(webdriver, session, all_offers)
            session.commit()
        except Exception:
            session.rollback()
            raise

    if cfg.generate_feed:
        await action_generate_feed(all_offers)
    else:
        logging.info("Skipping feed generation because it is disabled.")


async def scrape_offers(webdriver: BrowserContext) -> list[Offer]:
    cfg = Config.get()

    scraped_offers: list[Offer] = []
    for scraperType in get_all_scrapers():
        if (
            scraperType.get_type() in cfg.enabled_offer_types
            and scraperType.get_duration() in cfg.enabled_offer_durations
            and scraperType.get_source() in cfg.enabled_offer_sources
        ):
            scraper = scraperType(context=webdriver)
            scraper_duration = scraper.get_duration().value
            scraper_source = scraper.get_source().value

            logging.info(
                f"Analyzing {scraper_source} for offers: {scraper.get_type().value} / {scraper_duration}."
            )
            scraper_results = await scraper.scrape()

            if scraper_results:
                titles = ", ".join([offer.title for offer in scraper_results])
                logging.info(f"Found {len(scraper_results)} offers: {titles}.")
                scraped_offers.extend(scraper_results)
            else:
                logging.warning("Scraper finished without results.")

    return scraped_offers


async def process_new_offers(
    db: LootDatabase,
    webdriver: BrowserContext,
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
                await add_game_info(scraped_offer, session, webdriver)
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


async def send_new_offers_telegram(db: LootDatabase, bot: TelegramBot) -> None:
    session: Session = db.Session()
    try:
        user: User
        for user in session.execute(select(User)).scalars().all():
            if not user.inactive:
                await bot.send_new_announcements(user)
                await bot.send_new_offers(user)
    except Exception:
        session.rollback()
        raise


async def rebuild_game_infos(
    webdriver: BrowserContext, session: Session, all_offers: list[Offer]
) -> None:
    # Remove all game info first
    logging.info("Force update enabled - removing all game info")
    for game in session.query(Game):
        session.delete(game)

    # Then add new game info
    for db_offer in all_offers:
        await add_game_info(db_offer, session, webdriver)


async def action_generate_feed(loot_offers_in_db: list[Offer]) -> None:
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
        await generate_feed(
            offers=offers,
            file=feed_file,
            author_name=cfg.feed_author_name,
            author_web=cfg.feed_author_web,
            author_mail=cfg.feed_author_mail,
            feed_url_prefix=cfg.feed_url_prefix,
            feed_url_alternate=cfg.feed_url_alternate,
            feed_id_prefix=cfg.feed_id_prefix,
            source=source,
            type_=type_,
            duration=duration,
        )
        new_hash = hash_file(feed_file)
        if old_hash != new_hash:
            feed_changed = True
            any_feed_changed = True

        if feed_changed and cfg.upload_feed:
            await asyncio.to_thread(upload_to_server, feed_file)

    # Generate and upload cumulated feed
    if any_feed_changed:
        feed_file = Config.data_path() / Path(cfg.feed_file_prefix + ".xml")
        await generate_feed(
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
            await asyncio.to_thread(upload_to_server, feed_file_base)
        else:
            logging.info("Skipping upload, disabled")


async def add_game_info(
    offer: Offer, session: Session, webdriver: BrowserContext
) -> None:
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
        igdb_id = await get_igdb_id(offer.probable_game_name)

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
        steam_id = await get_steam_id(offer.probable_game_name, context=webdriver)

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
        offer.game.igdb_info = await get_igdb_details(id_=igdb_id)
    if steam_id:
        offer.game.steam_info = await get_steam_details(id_=steam_id, context=webdriver)


def log_new_offer(offer: Offer) -> None:
    res: str = f"New {offer.type} offer found: {offer.title}"
    if offer.valid_to:
        res += " " + offer.valid_to.strftime(TIMESTAMP_LONG)

    logging.info(res)


def hash_file(file: Path) -> str:
    if not file.exists():
        return ""

    hash_ = hashlib.sha256()

    with open(file, "rb") as f:
        while True:
            data = f.read(65536)
            if not data:
                break
            hash_.update(data)

    return hash_.hexdigest()


if __name__ == "__main__":
    # TODO: Test this, see https://stackoverflow.com/questions/37417595/graceful-shutdown-of-asyncio-coroutines
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
    finally:
        # Shutdown here
        pass

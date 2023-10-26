import argparse
import asyncio
import logging
import shutil
import sys
from contextlib import AsyncExitStack, suppress
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import TYPE_CHECKING, Type

import schedule
from sqlalchemy.exc import OperationalError

from lootscraper import __version__
from lootscraper.browser import get_browser_context
from lootscraper.common import TIMESTAMP_LONG
from lootscraper.config import Config
from lootscraper.database import LootDatabase
from lootscraper.processing import (
    action_generate_feed,
    process_new_offers,
    send_new_offers_telegram,
)
from lootscraper.scraper import get_all_scrapers
from lootscraper.telegrambot import TelegramBot, TelegramLoggingHandler
from lootscraper.tools import cleanup

if TYPE_CHECKING:
    from playwright.async_api import BrowserContext

    from lootscraper.scraper.scraper_base import Scraper

try:
    from xvfbwrapper import Xvfb

    # Logging not initialized yet, so we print to stdout
    print("Using virtual display")  # noqa: T201
    use_virtual_display = True
except ImportError:
    print("Using real display")  # noqa: T201
    use_virtual_display = False

logger = logging.getLogger()

# Tone down the logging of httpx, we don't need to see every request
logging.getLogger("httpx").setLevel(logging.WARNING)

EXAMPLE_CONFIG_FILE = "config.default.toml"
LOGFORMAT = "%(asctime)s [%(levelname)s] (%(name)s) %(message)s"


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="LootScraper",
        description="RSS feeds and Telegram bot for free game and loot offers.",
    )
    parser.add_argument(
        "-c",
        "--cleanup",
        help="do a cleanup run of the database "
        "(fix invalid offers, rescrape all game info)",
        action="store_true",
    )

    args = parser.parse_args()

    if args.cleanup:
        cleanup()
        return

    with suppress(KeyboardInterrupt):
        asyncio.run(run())


async def run() -> None:
    # Synchronously set up the basics we need to run anything
    initialize_config_file()
    check_config_file()
    setup_logging()

    logger.info(f"Starting LootScraper v{__version__}")

    # Run the various parts of the bot asynchronously (so we don't block)
    # and communicate using a queue.
    # TODO: Switch to a more generic queue that can handle multiple bots
    # when the Discord bot is added.
    telegram_queue: asyncio.Queue[int] = asyncio.Queue()

    try:
        with LootDatabase(echo=Config.get().db_echo) as db:
            async with asyncio.TaskGroup() as tg:  # type: ignore
                tg.create_task(run_scraper_loop(db, telegram_queue))
                if Config.get().telegram_bot:
                    tg.create_task(run_telegram_bot(db, telegram_queue))
    except OperationalError:
        logger.exception("Database error, exiting application.")
        sys.exit()

    logger.info(f"Exiting LootScraper v{__version__}")


def initialize_config_file() -> None:
    """Copy the config file to the data directory if there is not yet a config
    file there.
    """
    config_file = Config.config_file()
    if not config_file.is_file():
        create_config_file(config_file)


def create_config_file(config_file: Path) -> None:
    """Create a new config file from the example config file."""
    print(f"Config file {config_file} not found, creating a new one")  # noqa: T201
    config_file.parent.mkdir(exist_ok=True, parents=True)
    shutil.copy(EXAMPLE_CONFIG_FILE, config_file)


def check_config_file() -> None:
    """Check if the config file is valid and can be read."""
    # Now we can try to read the config file. In case anything goes wrong, we
    # terminate because without a valid config continuing is useless.
    try:
        Config.get()
    except Exception as e:
        print(f"Config could not be loaded: {e}")  # noqa: T201
        sys.exit()


def setup_logging() -> None:
    """Set up the logging system."""
    filename = Config.data_path() / Path(Config.get().log_file)
    loglevel = logging.getLevelName(Config.get().log_level)
    handlers: list[logging.Handler] = []

    # Default stream handler for console output
    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(logging.Formatter(LOGFORMAT))
    handlers.append(stream_handler)

    # Create a rotating log file, size: 5 MB, keep 10 files
    file_handler = RotatingFileHandler(filename, maxBytes=5 * 1024**2, backupCount=10)
    file_handler.setFormatter(logging.Formatter(LOGFORMAT))
    handlers.append(file_handler)

    logging.basicConfig(
        encoding="utf-8",
        level=loglevel,
        handlers=handlers,
        format=LOGFORMAT,
        datefmt=TIMESTAMP_LONG,
    )


async def run_telegram_bot(
    db: LootDatabase,
    queue: asyncio.Queue[int],
) -> None:
    """
    Run the Telegram bot and send new offers when there is a new entry in the
    queue.
    """
    async with TelegramBot(Config.get(), db) as bot:
        # The bot is running now and will stop when the context exits
        try:
            telegram_handler = TelegramLoggingHandler(bot)
            # Only log errors and above to Telegram. TODO: Make this configurable.
            telegram_handler.setLevel(logging.ERROR)
            telegram_handler.setFormatter(logging.Formatter(LOGFORMAT))
            logger.addHandler(telegram_handler)
        except Exception:
            logger.exception("Could not add Telegram logging handler.")

        while True:
            run_no = await queue.get()
            logger.info(
                "Sending offers on Telegram that were found in scraping run #"
                + str(run_no)
                + ".",
            )

            try:
                await send_new_offers_telegram(db, bot)
            except OperationalError:
                # We handle DB errors on a higher level
                raise
            except Exception as e:
                # This is our catch-all. Something really unexpected occurred.
                # Log it with the highest priority and continue with the
                # next run.
                logger.critical(e)

            queue.task_done()


async def run_scraper_loop(
    db: LootDatabase,
    telegram_queue: asyncio.Queue[int],
) -> None:
    """Run the scraping job in a loop with the scheduling set in the scraper classes."""
    # No scrapers, no point in continuing
    if len(Config.get().enabled_offer_sources) == 0:
        logger.warning("No sources enabled, exiting.")
        return

    async with AsyncExitStack() as stack:
        # Check the "global" variable (set on import) to see if we can use a
        # virtual display
        if use_virtual_display:
            stack.enter_context(Xvfb())

        # Use one single browser instance for all scrapers
        browser_context: BrowserContext = await stack.enter_async_context(
            get_browser_context(),
        )

        # Use a single database session for all scrapers
        db_session = db.Session()

        # Initialize the task queue. The queue is used to schedule the scraping
        # tasks. Each scraper is scheduled by adding a task to the queue. The
        # worker function then dequeues the task and calls the appropriate
        # scraper.
        task_queue: asyncio.Queue[Type[Scraper]] = asyncio.Queue()

        async def worker() -> None:
            run_no = 0
            while True:
                # This triggers when the time has come to run a scraper
                scraper_class = await task_queue.get()

                run_no += 1
                logger.debug(f"Executing scheduled task #{run_no}.")

                try:
                    scraper_instance = scraper_class(context=browser_context)
                    scraped_offers = await scraper_instance.scrape()
                    await process_new_offers(
                        db,
                        browser_context,
                        db_session,
                        scraped_offers,
                    )

                    if Config.get().generate_feed:
                        await action_generate_feed(db)
                    else:
                        logging.info("Skipping feed generation because it is disabled.")

                    if Config.get().telegram_bot:
                        await telegram_queue.put(run_no)
                    else:
                        logging.debug(
                            "Skipping Telegram notification because it is disabled.",
                        )
                except OperationalError:
                    # We handle DB errors on a higher level
                    raise
                except Exception as e:
                    # This is our catch-all. Something really unexpected occurred.
                    # Log it with the highest priority and continue with the
                    # next scheduled run when it's due.
                    logger.critical(e)

                task_queue.task_done()

        # Schedule each scraper that is enabled
        for scraper_class in get_all_scrapers():
            for job in scraper_class.get_schedule():
                if scraper_class.is_enabled():
                    # Enqueue the scraper job into the task queue with the
                    # scraper class and the database session as arguments
                    job.do(task_queue.put_nowait, scraper_class)

        # Create the worker task that will run the next task in the queue when
        # it is due
        asyncio.create_task(worker())

        # Run tasks once after startup
        schedule.run_all()

        # Then run the tasks in a loop according to their schedule
        while True:
            logger.debug("Checking if there are tasks to schedule.")
            schedule.run_pending()
            await asyncio.sleep(1)

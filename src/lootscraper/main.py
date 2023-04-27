import argparse
import asyncio
import logging
import shutil
import sys
from contextlib import ExitStack
from datetime import datetime, timedelta
from logging.handlers import RotatingFileHandler
from pathlib import Path

from sqlalchemy.exc import OperationalError

from lootscraper import __version__
from lootscraper.common import TIMESTAMP_LONG
from lootscraper.config import Config
from lootscraper.database import LootDatabase
from lootscraper.processing import scrape_new_offers, send_new_offers_telegram
from lootscraper.telegrambot import TelegramBot, TelegramLoggingHandler
from lootscraper.tools import cleanup

try:
    from xvfbwrapper import Xvfb

    # Logging not initialized yet, so we print to stdout
    print("Using virtual display")
    use_virtual_display = True
except ImportError:
    print("Using real display")
    use_virtual_display = False

logger = logging.getLogger()

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
        help="do a cleanup run of the database (fix invalid offers, rescrape all game info)",
        action="store_true",
    )

    args = parser.parse_args()

    if args.cleanup:
        cleanup()
        return

    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        pass


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
    except OperationalError as db_error:
        logger.error(f"Database error, exiting application: {db_error}")
        sys.exit()

    logger.info(f"Exiting LootScraper v{__version__}")


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
    except Exception as e:  # pylint: disable=broad-except
        print(f"Config could not be loaded: {e}")
        sys.exit()


def setup_logging() -> None:
    """
    Set up the logging system.
    """
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
    async with TelegramBot(Config.get(), db.Session) as bot:
        # The bot is running now and will stop when the context exits
        try:
            telegram_handler = TelegramLoggingHandler(bot)
            # Only log errors and above to Telegram. TODO: Make this configurable.
            telegram_handler.setLevel(logging.ERROR)
            telegram_handler.setFormatter(logging.Formatter(LOGFORMAT))
            logger.addHandler(telegram_handler)
        except Exception as e:  # pylint: disable=broad-except
            logger.error(f"Could not add Telegram logging handler: {e}")

        while True:
            run_no = await queue.get()
            logger.info(
                f"Sending offers on Telegram that were found in scraping run #{run_no}.",
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
                logger.critical(e)

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

        time_between_runs = int(Config.get().wait_between_runs_seconds)

        # Loop forever (until terminated by external events)
        run_no = 0
        while True:
            run_no += 1

            logger.info(f"Starting scraping run #{run_no}.")

            try:
                await scrape_new_offers(db)
            except OperationalError:
                # We handle DB errors on a higher level
                raise
            except Exception as e:  # pylint: disable=broad-except
                # This is our catch-all. Something really unexpected occurred.
                # Log it with the highest priority and continue with the
                # next run.
                logger.critical(e)

            if time_between_runs == 0:
                break

            next_execution = datetime.now() + timedelta(seconds=time_between_runs)

            logger.info(f"Next scraping run will be at {next_execution.isoformat()}.")

            if Config.get().telegram_bot:
                await telegram_queue.put(run_no)

            await asyncio.sleep(time_between_runs)

        logger.info(f"Finished {run_no} runs")

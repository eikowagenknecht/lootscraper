import asyncio
import logging

from playwright.async_api import BrowserContext
from sqlalchemy.orm import Session

from app.browser import get_browser_context
from app.database import Game, IgdbInfo, LootDatabase, Offer, SteamInfo
from lootscraper import add_game_info

logger = logging.getLogger(__name__)


async def refresh_all_games(session: Session, context: BrowserContext) -> None:
    """
    This drops all games from the database and re-adds them, scraping all
    information again.
    """

    logger.info("Dropping all existing information from database")
    session.query(Game).delete()
    session.query(SteamInfo).delete()
    session.query(IgdbInfo).delete()
    session.commit()

    all_offers = session.query(Offer).all()

    logger.info("Gathering new information")
    for offer in all_offers:
        logger.info(f"Adding game info for offer {offer.id}")
        await add_game_info(offer, session, context)

    session.commit()


def fix_image_nones(session: Session) -> None:
    """
    Remove empty image URLs from the database.
    """
    offer: Offer
    for offer in session.query(Offer):
        # Replace empty values with correct NULLs
        if offer.img_url in ("", "None"):
            logger.info(f"Cleaning up empty image URL for offer {offer.id}")
            offer.img_url = None

    session.commit()


async def run_cleanup() -> None:
    """
    Run cleanup functions
    """
    logger.info("Running cleanup")
    with LootDatabase(echo=False) as db:
        fix_image_nones(db.Session())

        async with get_browser_context() as context:
            await refresh_all_games(db.Session(), context)


def cleanup() -> None:
    """
    Synchronous wrapper for cleanup functions. Run this with
    `python -c 'import app.tools; app.tools.cleanup()'` for now.
    TODO: Add an admin command for this (telegram)
    """
    asyncio.run(run_cleanup())

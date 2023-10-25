"""Contains tools that can be run from the command line."""

import asyncio
import logging

from playwright.async_api import BrowserContext
from sqlalchemy.orm import Session

from lootscraper.browser import get_browser_context
from lootscraper.common import Category, OfferDuration, OfferType
from lootscraper.database import Game, IgdbInfo, LootDatabase, Offer, SteamInfo
from lootscraper.processing import add_game_info
from lootscraper.scraper.scraper_base import Scraper
from lootscraper.utils import (
    clean_combined_title,
    clean_game_title,
    clean_loot_title,
)

logger = logging.getLogger(__name__)


def log(msg: str) -> None:
    """Log a message to the console and the logger."""
    print(msg)  # noqa
    logger.info(msg)


async def refresh_all_games(session: Session, context: BrowserContext) -> None:
    """
    Drop all games from the database and re-add them, scraping all
    information again.
    """
    all_offers = session.query(Offer).all()
    # Remove all games from the database. Skip this step if you don't want to
    # re-scrape all games.
    logger.info("Dropping all existing information from database")
    for offer in all_offers:
        offer.game_id = None
    session.query(Game).delete()
    session.query(SteamInfo).delete()
    session.query(IgdbInfo).delete()
    # Commit all changes at once to keep the database consistent.
    session.commit()

    log("Gathering new information")
    for offer in all_offers:
        # Use this to skip offers that have already been processed (e.g. when
        # the script crashed).
        # if offer.id < 2678:
        #     continue
        log(f"Adding game info for offer {offer.id}.")
        await add_game_info(offer, session, context)
        # Save after every offer to avoid losing progress.
        session.commit()


def delete_invalid_offers(session: Session) -> None:
    """Delete invalid offers from the database."""
    offer: Offer
    for offer in session.query(Offer):
        if offer.category in [Category.DEMO, Category.PRERELEASE]:
            log(f"Deleting invalid offer {offer.id}.")
            session.delete(offer)

    session.commit()


def fix_image_nones(session: Session) -> None:
    """Remove empty image URLs from the database."""
    offer: Offer
    for offer in session.query(Offer):
        if offer.img_url in ("", "None"):
            log(f"Cleaning up empty image URL for offer {offer.id}.")
            offer.img_url = None

    session.commit()


def fix_offer_titles(session: Session) -> None:
    """Trim offer titles and remove line breaks."""
    offer: Offer
    for offer in session.query(Offer):
        if offer.rawtext is None:
            continue

        new_title = None
        new_probable_name = None

        if offer.type == OfferType.GAME:
            new_title = clean_game_title(offer.rawtext["title"])
            new_probable_name = new_title
        elif offer.type == OfferType.LOOT:
            try:
                new_probable_name = clean_game_title(offer.rawtext["gametitle"])
                new_title = (
                    new_probable_name + " - " + clean_loot_title(offer.rawtext["title"])
                )
            except KeyError:
                new_probable_name, new_title = clean_combined_title(
                    offer.rawtext["title"],
                )

        if new_title != offer.title:
            log(
                f"Cleaning up title for offer {offer.id}. "
                f"Old: {offer.title}, new: {new_title}.",
            )
            offer.title = new_title

        if new_probable_name != offer.probable_game_name:
            log(
                f"Cleaning up probable game name for offer {offer.id}. "
                f"Old: {offer.probable_game_name}, new: {new_probable_name}.",
            )
            offer.probable_game_name = new_probable_name

    session.commit()


def fix_offer_categories(session: Session) -> None:
    """Fix offer categories (demo etc.)."""
    offer: Offer
    for offer in session.query(Offer):
        if Scraper.is_demo(offer.title):
            if offer.category != Category.DEMO:
                log(
                    f"Cleaning up category for offer {offer.id}. "
                    f"Old: {offer.category}, new: {Category.DEMO}.",
                )
                offer.category = Category.DEMO
            continue
        if Scraper.is_prerelease(offer.title):
            if offer.category != Category.PRERELEASE:
                log(
                    f"Cleaning up category for offer {offer.id}. "
                    f"Old: {offer.category}, new: {Category.PRERELEASE}.",
                )
                offer.category = Category.PRERELEASE
            continue
        if Scraper.is_fake_always(offer.valid_to):
            if offer.duration != OfferDuration.ALWAYS:
                log(
                    f"Cleaning up duration for offer {offer.id}. "
                    f"Old: {offer.duration}, new: {OfferDuration.ALWAYS}.",
                )
                offer.duration = OfferDuration.ALWAYS
            continue

    session.commit()


async def run_cleanup() -> None:
    """Clean common problems."""
    log("Running cleanup")
    with LootDatabase(echo=False) as db:
        fix_image_nones(db.Session())
        fix_offer_titles(db.Session())
        fix_offer_categories(db.Session())
        # Delete offers that have been invalidated by the above.
        delete_invalid_offers(db.Session())


async def run_refresh() -> None:
    """Refresh all game data."""
    log("Running refresh")
    with LootDatabase(echo=False) as db:
        async with get_browser_context() as context:
            await refresh_all_games(db.Session(), context)


def cleanup() -> None:
    """
    Wrap cleanup functions synchronously.

    Run this with `python -c 'import lootscraper.tools; lootscraper.tools.cleanup()'`
    for now.
    """
    # TODO: Add an admin command for this (telegram).
    asyncio.run(run_cleanup())


def refresh() -> None:
    """
    Wrap cleanup functions synchronously.

    Run this with `python -c 'import lootscraper.tools; lootscraper.tools.refresh()'`
    for now.
    """
    # TODO: Add an admin command for this (telegram).
    asyncio.run(run_refresh())

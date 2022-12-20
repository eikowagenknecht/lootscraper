import logging

from playwright.async_api import BrowserContext
from sqlalchemy.orm import Session

from app.database import LootDatabase, Offer, SteamInfo
from app.scraper.info.steam import get_steam_details

logger = logging.getLogger(__name__)


async def refresh_all_steam_info(session: Session, context: BrowserContext) -> None:
    """
    Refresh Steam information for all games in the database
    """
    logger.info("Refreshing Steam information")
    steam_info: SteamInfo
    for steam_info in session.query(SteamInfo):
        new_steam_info = await get_steam_details(id_=steam_info.id, context=context)
        if new_steam_info is None:
            return
        steam_info.name = new_steam_info.name
        steam_info.short_description = new_steam_info.short_description
        steam_info.release_date = new_steam_info.release_date
        steam_info.publishers = new_steam_info.publishers
        steam_info.image_url = new_steam_info.image_url
        steam_info.recommendations = new_steam_info.recommendations
        steam_info.percent = new_steam_info.percent
        steam_info.score = new_steam_info.score
        steam_info.metacritic_score = new_steam_info.metacritic_score
        steam_info.metacritic_url = new_steam_info.metacritic_url
        steam_info.recommended_price_eur = new_steam_info.recommended_price_eur


def harmonize_database(session: Session) -> None:
    """
    Harmonize the database by removing duplicates and updating information
    """
    logger.info("Harmonizing database")
    offer: Offer
    for offer in session.query(Offer):
        # Replace empty values with correct NULLs
        if offer.img_url in ("", "None"):
            logger.info(f"Cleaning up empty image URL for offer {offer.id}")
            offer.img_url = None

    session.commit()


def run_cleanup() -> None:
    """
    Run cleanup functions
    """
    logger.info("Running cleanup")
    with LootDatabase(echo=False) as db:
        harmonize_database(db.Session())

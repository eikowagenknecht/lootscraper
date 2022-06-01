import logging
from datetime import datetime, timezone

from selenium.webdriver.chrome.webdriver import WebDriver
from sqlalchemy.orm import Session

from app.common import Channel
from app.scraper.info.steam import get_steam_details
from app.sqlalchemy import Announcement, LootDatabase, SteamInfo
from app.telegram import markdown_escape

logger = logging.getLogger(__name__)


def refresh_all_steam_info(session: Session, webdriver: WebDriver) -> None:
    """
    Refresh Steam information for all games in the database
    """
    logger.info("Refreshing Steam information")
    steam_info: SteamInfo
    for steam_info in session.query(SteamInfo):
        new_steam_info = get_steam_details(id=steam_info.id, driver=webdriver)
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


def add_announcement(session: Session) -> None:
    """
    Add an announcement to the database
    """

    announcement_header = "2022-04-29 - Announcing: Announcements!"
    announcement_text = (
        "Yes, that's right. This is an announcement to announce announcements! "
        "From now on, every time there is something new to announce, you will get a message from me. "
        "I'll try to keep the spam volume low, though ;-)"
        "That's it for now! I hope you enjoyed the announcement!"
    )

    announcement_full = (
        "*"
        + markdown_escape(announcement_header)
        + "*"
        + "\n\n"
        + markdown_escape(announcement_text)
    )

    announcement = Announcement(
        channel=Channel.TELEGRAM,
        date=datetime.now().replace(tzinfo=timezone.utc),
        text_markdown=announcement_full,
    )
    try:
        session.add(announcement)
        session.commit()
    except NameError:
        # No session given
        with LootDatabase(False) as db:
            db.Session().add(announcement)
            db.Session().commit()
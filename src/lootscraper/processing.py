import asyncio
import hashlib
import logging
from datetime import datetime, timezone
from pathlib import Path

from playwright.async_api import BrowserContext
from sqlalchemy import select
from sqlalchemy.orm import Session

from lootscraper.common import TIMESTAMP_LONG, OfferDuration, OfferType, Source
from lootscraper.config import Config
from lootscraper.database import (
    Game,
    IgdbInfo,
    LootDatabase,
    Offer,
    SteamInfo,
    TelegramChat,
)
from lootscraper.feed import generate_feed
from lootscraper.html import generate_html
from lootscraper.scraper import get_all_scrapers
from lootscraper.scraper.info_igdb import get_igdb_details, get_igdb_id
from lootscraper.scraper.info_steam import get_steam_details, get_steam_id
from lootscraper.telegrambot import TelegramBot
from lootscraper.upload import upload_to_server

logger = logging.getLogger(__name__)


async def process_new_offers(
    db: LootDatabase,
    context: BrowserContext,
    session: Session,
    scraped_offers: list[Offer],
) -> None:
    """
    Check which offers are new and which are updated, then act accordingly:
    - Offers that are neither new nor updated just get a new date
    - Offers that are new are inserted
    - Offers that are updated are updated.
    """
    cfg = Config.get()

    nr_of_new_offers: int = 0
    new_offer_titles: list[str] = []

    try:
        for scraped_offer in scraped_offers:
            # Get the existing entry if there is one
            existing_entry: Offer | None = db.find_offer(
                scraped_offer.source,
                scraped_offer.type,
                scraped_offer.duration,
                scraped_offer.title,
                scraped_offer.valid_to,
            )

            if not existing_entry:
                if scraped_offer.title:
                    new_offer_titles.append(scraped_offer.title)

                    # The enddate has been changed or it is a new offer,
                    # get information about it (if it's a game)
                    # and insert it into the database
                if cfg.scrape_info:
                    await add_game_info(scraped_offer, session, context)

                # Insert the new offer into the database.
                db.add_offer(scraped_offer)
                nr_of_new_offers += 1
            else:
                # Update offers that already have been scraped.
                db.update_db_offer(existing_entry, scraped_offer)

        if new_offer_titles:
            logging.info(
                f'Found {nr_of_new_offers} new offers: {", ".join(new_offer_titles)}',
            )

        session.commit()
    except Exception:
        session.rollback()
        raise


async def send_new_offers_telegram(db: LootDatabase, bot: TelegramBot) -> None:
    session: Session = db.Session()
    try:
        user: TelegramChat
        for user in session.execute(select(TelegramChat)).scalars().all():
            if not user.inactive_reason:
                await bot.send_new_announcements(user)
                await bot.send_new_offers(user)
    except Exception:
        session.rollback()
        raise


async def action_generate_feed(db: LootDatabase) -> None:
    cfg = Config.get()
    feed_file_base = Config.data_path() / Path(cfg.feed_file_prefix + ".xml")

    any_feed_changed = False

    source: Source
    type_: OfferType
    duration: OfferDuration

    all_offers = db.read_all()
    active_offers = db.read_active_offers(datetime.now(tz=timezone.utc))

    # Generate and upload feeds split by source
    for source, type_, duration in [
        (x.get_source(), x.get_type(), x.get_duration()) for x in get_all_scrapers()
    ]:
        filtered_offers = [
            offer
            for offer in all_offers
            if offer.source == source
            and offer.type == type_
            and offer.duration == duration
        ]
        if not filtered_offers:
            continue

        filtered_active_offers = [
            offer
            for offer in active_offers
            if offer.source == source
            and offer.type == type_
            and offer.duration == duration
        ]

        feed_file_core = f"_{source.name.lower()}_{type_.name.lower()}"

        # To keep the old feed ids and names only add when the type is one of
        # the new types.
        if duration != OfferDuration.CLAIMABLE:
            feed_file_core += f"_{duration.name.lower()}"

        feed_file = Config.data_path() / Path(
            cfg.feed_file_prefix + feed_file_core + ".xml",
        )

        old_hash = hash_file(feed_file)
        await generate_feed(
            offers=filtered_active_offers,
            file=feed_file,
            author_name=cfg.feed_author_name,
            author_web=cfg.feed_author_web,
            author_mail=cfg.feed_author_email,
            feed_url_prefix=cfg.feed_url_prefix,
            feed_url_alternate=cfg.feed_url_alternate,
            feed_id_prefix=cfg.feed_id_prefix,
            source=source,
            type_=type_,
            duration=duration,
        )
        new_hash = hash_file(feed_file)
        if old_hash != new_hash:
            any_feed_changed = True

        feed_changed = old_hash != new_hash

        if feed_changed and cfg.upload_to_ftp:
            await asyncio.to_thread(upload_to_server, feed_file)

        # Also generate a html version of the feed
        generate_html(
            offers=filtered_active_offers,
            file=feed_file.with_suffix(".html"),
            author_name=cfg.feed_author_name,
            author_web=cfg.feed_author_web,
            author_mail=cfg.feed_author_email,
            feed_id_prefix=cfg.feed_id_prefix,
            source=source,
            type_=type_,
            duration=duration,
        )

        html_file_all = Config.data_path() / Path(
            cfg.feed_file_prefix + feed_file_core + "_all.html",
        )

        # Also generate a full html version of the feed
        generate_html(
            offers=filtered_offers,
            file=html_file_all,
            author_name=cfg.feed_author_name,
            author_web=cfg.feed_author_web,
            author_mail=cfg.feed_author_email,
            feed_id_prefix=cfg.feed_id_prefix,
            source=source,
            type_=type_,
            duration=duration,
        )

        if feed_changed and cfg.upload_to_ftp:
            await asyncio.to_thread(upload_to_server, feed_file.with_suffix(".html"))
            await asyncio.to_thread(upload_to_server, html_file_all)

    # Generate and upload cumulated feed
    if any_feed_changed:
        feed_file = Config.data_path() / Path(cfg.feed_file_prefix + ".xml")
        await generate_feed(
            offers=active_offers,
            file=feed_file,
            author_name=cfg.feed_author_name,
            author_web=cfg.feed_author_web,
            author_mail=cfg.feed_author_email,
            feed_url_prefix=cfg.feed_url_prefix,
            feed_url_alternate=cfg.feed_url_alternate,
            feed_id_prefix=cfg.feed_id_prefix,
        )

        generate_html(
            offers=active_offers,
            file=feed_file.with_suffix(".html"),
            author_name=cfg.feed_author_name,
            author_web=cfg.feed_author_web,
            author_mail=cfg.feed_author_email,
            feed_id_prefix=cfg.feed_id_prefix,
        )

        html_file_all = Config.data_path() / Path(cfg.feed_file_prefix + "_all.html")

        # Also generate a full html version of the feed
        generate_html(
            offers=all_offers,
            file=html_file_all,
            author_name=cfg.feed_author_name,
            author_web=cfg.feed_author_web,
            author_mail=cfg.feed_author_email,
            feed_id_prefix=cfg.feed_id_prefix,
        )

        if cfg.upload_to_ftp:
            await asyncio.to_thread(upload_to_server, feed_file_base)
            await asyncio.to_thread(
                upload_to_server,
                feed_file_base.with_suffix(".html"),
            )
            await asyncio.to_thread(upload_to_server, html_file_all)
        else:
            logging.info("Skipping upload, disabled")


async def add_game_info(
    offer: Offer,
    session: Session,
    context: BrowserContext,
) -> None:
    """
    Update an offer with game information. If the offer already has some
    information, just update the missing parts. Otherwise, create a new
    Game and try to populate it with information.
    """
    if offer.game:
        # The offer already has a game attached, leave it alone
        return

    # Offer has no game name, so we can't add any game related information
    if offer.probable_game_name is None:
        logging.warning(f"Offer {offer} has no game name, so we can't add any info")
        return

    existing_game: Game | None = None

    # Offer has a name but no game. Try to find an exact match in our local
    # database first (prioritize IGDB)
    igdb_id = (
        session.execute(
            select(IgdbInfo.id).where(IgdbInfo.name == offer.probable_game_name),
        )
        .scalars()
        .one_or_none()
    )

    # If there's no exact local match, check the IGDB api
    if igdb_id is None and Config.get().info_igdb:
        igdb_id = await get_igdb_id(offer.probable_game_name)

    # If we found a match, check if we already have a local entry for it, so we
    # don't have to query the slow Steam API
    if igdb_id is not None:
        existing_game = (
            session.execute(select(Game).where(Game.igdb_id == igdb_id))
            .scalars()
            .one_or_none()
        )

    if existing_game:
        offer.game = existing_game
        return

    # No local entry yet, try to find a matching entry via Steam
    steam_id = (
        session.execute(
            select(SteamInfo.id).where(SteamInfo.name == offer.probable_game_name),
        )
        .scalars()
        .one_or_none()
    )

    # Use the Steam api if no local entry exists
    if steam_id is None and Config.get().info_steam:
        steam_id = await get_steam_id(offer.probable_game_name, context=context)

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

    # We have some new match. Get additional details from the APIs
    igdb_info = (
        await get_igdb_details(id_=igdb_id)
        if igdb_id and Config.get().info_igdb
        else None
    )
    steam_info = (
        await get_steam_details(id_=steam_id, context=context)
        if steam_id and Config.get().info_steam
        else None
    )

    # If one of the two APIs returned an exact match and the other one didn't,
    # only use the exact match. Otherwise, use both (as available).
    offer.game = Game()
    igdb_exact_match = (
        igdb_info
        and igdb_info.name
        and igdb_info.name.lower() == offer.probable_game_name.lower()
    )
    steam_exact_match = (
        steam_info
        and steam_info.name
        and steam_info.name.lower() == offer.probable_game_name.lower()
    )

    if igdb_info and (igdb_exact_match or not steam_exact_match):
        offer.game.igdb_info = igdb_info
    if steam_info and (steam_exact_match or not igdb_exact_match):
        offer.game.steam_info = steam_info


def log_new_offer(offer: Offer) -> None:
    res: str = f"New {offer.type} offer found: {offer.title}"
    if offer.valid_to:
        res += " " + offer.valid_to.strftime(TIMESTAMP_LONG)

    logging.info(res)


def hash_file(file: Path) -> str:
    if not file.exists():
        return ""

    hash_ = hashlib.sha256()

    with file.open(mode="rb") as f:
        while True:
            data = f.read(65536)
            if not data:
                break
            hash_.update(data)

    return hash_.hexdigest()

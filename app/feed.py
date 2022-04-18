# mypy: ignore-errors
import html
from datetime import datetime
from pathlib import Path

from feedgen.feed import FeedEntry, FeedGenerator

from app.sqlalchemy import Game, Offer

from .common import (
    TIMESTAMP_LONG,
    TIMESTAMP_READABLE_WITH_HOUR,
    TIMESTAMP_SHORT,
    OfferType,
    Source,
)


def generate_feed(
    offers: list[Offer],
    feed_file_base: Path,
    author_name: str,
    author_mail: str,
    author_web: str,
    feed_url_prefix: str,
    feed_url_alternate: str,
    feed_id_prefix: str,
    source: Source = None,
    type: OfferType = None,
) -> None:
    """
    Generates a feed using the ATOM standard, see
    http://www.atomenabled.org/developers/syndication/#requiredFeedElements for
    details.
    """

    if len(offers) == 0:
        return

    if source is not None and type is not None:
        file = feed_file_base.with_stem(
            f"{feed_file_base.stem}_{source.name.lower()}_{type.name.lower()}"
        )
    else:
        file = feed_file_base

    feed_generator = FeedGenerator()
    latest_date: datetime = None

    for offer in offers:
        # Skip entries without any dates, they are probably not valid
        if not offer.seen_first and not offer.seen_last:
            continue

        # Skip future entries and entries that are no longer seen before they ever were valid
        if offer.valid_from and offer.valid_from > offer.seen_last:
            continue

        # Determine the date to use for updated. Preferred is valid_from,
        # but seen_first is used if valid_from is not known.
        if offer.valid_from and offer.valid_from > offer.seen_first:
            updated = offer.valid_from
        else:
            updated = offer.seen_first

        # Remember the newest entry date for the whole feed date
        if not latest_date or updated > latest_date:
            latest_date = updated

        feed_entry: FeedEntry = feed_generator.add_entry()
        # Atom Needed
        feed_entry.id(f"{feed_id_prefix}{int(offer.id)}")
        title = f"{offer.source.value} ({offer.type.value}) - {offer.title}"
        feed_entry.title(title)
        feed_entry.updated(updated)
        # Atom Recommended
        # - Author
        feed_entry.author(
            {
                "name": author_name,
                "email": author_mail,
                "uri": author_web,
            }
        )
        # - Content
        game: Game = offer.game
        content = ""
        if offer.img_url:
            content += f'<img src="{html.escape(offer.img_url)}" />'
        elif game and game.image_url:
            content += f'<img src="{html.escape(game.image_url)}" />'
        content += "<ul>"
        valid_from = (
            offer.valid_from.strftime(TIMESTAMP_READABLE_WITH_HOUR)
            if offer.valid_from
            else offer.seen_first.strftime(TIMESTAMP_READABLE_WITH_HOUR)
        )
        content += f"<li><b>Offer valid from:</b> {valid_from}</li>"
        if offer.valid_to:
            content += f"<li><b>Offer valid to:</b> {offer.valid_to.strftime(TIMESTAMP_READABLE_WITH_HOUR)}</li>"
        content += "</ul>"
        if offer.url:
            content += f'<p>Claim it now on <a href="{html.escape(offer.url)}">{html.escape(offer.source.value)}</a>.</p>'
        if game:
            content += "<p>About the game"
            if game.name:
                content += f" (<b>{html.escape(game.name)}</b>*)"
            content += ":</p>"

            content += "<ul>"
            ratings = []
            if game.metacritic_score:
                text = f"Metacritic {game.metacritic_score} %"
                if game.metacritic_url:
                    text = f'<a href="{html.escape(game.metacritic_url)}">{text}</a>'
                ratings.append(text)

            if game.igdb_meta_ratings and game.igdb_meta_score:
                text = f"IGDB Meta {game.igdb_meta_score} % ({game.igdb_meta_ratings} sources)"
                if game.igdb_url:
                    text = f'<a href="{html.escape(game.igdb_url)}">{text}</a>'
                ratings.append(text)
            if game.igdb_user_ratings and game.igdb_user_score:
                text = f"IGDB User {game.igdb_user_score} % ({game.igdb_user_ratings} sources)"
                if game.igdb_url:
                    text = f'<a href="{html.escape(game.igdb_url)}">{text}</a>'
                ratings.append(text)
            if game.steam_percent and game.steam_score and game.steam_recommendations:
                text = f"Steam {game.steam_percent} % ({game.steam_score}/10, {game.steam_recommendations} recommendations)"
                if game.steam_url:
                    text = f'<a href="{html.escape(game.steam_url)}">{text}</a>'
                ratings.append(text)
            if len(ratings) > 0:
                content += f"<li><b>Ratings:</b> {' / '.join(ratings)}</li>"
            if game.release_date:
                content += f"<li><b>Release date:</b> {html.escape(game.release_date.strftime(TIMESTAMP_SHORT))}</li>"
            if game.recommended_price_eur:
                content += f"<li><b>Recommended price (Steam):</b> {game.recommended_price_eur} EUR</li>"
            if game.short_description:
                content += f"<li><b>Description:</b> {html.escape(game.short_description)}</li>"
            if game.genres:
                content += (
                    f'<li><b>Genres:</b> {html.escape(", ".join(game.genres))}</li>'
                )
            content += "</ul>"

        content += "<p>* Any information about the offer is automatically grabbed and may in rare cases not match the correct game.</p>"
        content += f'<p><small>Source: {html.escape(offer.source.value)}, Seen first: {offer.seen_first.strftime(TIMESTAMP_LONG)}, Generated by <a href="https://github.com/eikowagenknecht/lootscraper">LootScraper</a></small></p>'
        feed_entry.content(content, type="xhtml")
        # - Link
        feed_entry.link(rel="alternate", href=offer.url)
        # - Summary
        # Atom Optional
        # - category
        # - contributor
        # - published
        feed_entry.published(offer.seen_first)
        # - source
        # - rights

    # XML
    feed_generator.language("en")
    # Atom Needed
    feed_id = get_feed_id(file.name) if file.name != feed_file_base.name else ""
    feed_generator.id(feed_id_prefix + feed_id)
    feed_generator.title(get_feed_title(source, type))
    feed_generator.updated(latest_date)
    # Atom Recommended
    feed_generator.link(rel="self", href=f"{feed_url_prefix}{file.name}")
    feed_generator.link(rel="alternate", href=feed_url_alternate)
    feed_generator.author(
        {
            "name": author_name,
            "email": author_mail,
            "uri": author_web,
        }
    )
    # Atom Optional
    # - Category
    # - Contributor
    # - Generator
    feed_generator.generator(
        generator="LootScraper", uri="https://github.com/eikowagenknecht/lootscraper"
    )
    # - Icon
    # - Logo
    # - Rights
    # - Subtitle

    # Write the ATOM feed to a file
    feed_generator.atom_file(filename=str(file), pretty=True)


def get_feed_id(filename: str) -> str:
    # Use the part between "<base_filename>_" and ".xml" as the feed id
    subfeed = filename.split("_", 1)[1][0:-4]
    return subfeed


def get_feed_title(source: Source | None, type: OfferType | None):
    if source is None and type is None:
        return "Free Games and Loot"

    title = "Free"
    if source is not None:
        title += " " + source.value
    if type is not None:
        match type:
            case OfferType.GAME:
                title += " games"
            case OfferType.LOOT:
                title += " loot"

    return title

# mypy: ignore-errors
import html
from datetime import datetime
from pathlib import Path

from feedgen.feed import FeedGenerator, FeedEntry

from .common import (
    TIMESTAMP_LONG,
    TIMESTAMP_READABLE_WITH_HOUR,
    LootOffer,
    OfferType,
    Source,
)


def generate_feed(
    offers: list[LootOffer],
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
    """Generates a feed using the ATOM standard, see
    http://www.atomenabled.org/developers/syndication/#requiredFeedElements for
    details."""

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
        if not latest_date or offer.seen_first > latest_date:
            latest_date = offer.seen_first

        if offer.valid_from and offer.valid_from > offer.seen_last:
            # Skip future entries and entries that are no longer seen on valid_from date
            continue

        if offer.valid_from and offer.valid_from > offer.seen_first:
            updated = offer.valid_from
        else:
            updated = offer.seen_first

        feed_entry: FeedEntry = feed_generator.add_entry()
        # Atom Needed
        feed_entry.id(f"{feed_id_prefix}{int(offer.id)}")
        title = f"{offer.source.value} ({offer.type.value}) - {offer.title}"
        if offer.subtitle:
            title += f": {offer.subtitle}"
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
        content = ""
        if offer.img_url:
            content += f'<img src="{html.escape(offer.img_url)}" />'
        elif offer.gameinfo and offer.gameinfo.image_url:
            content += f'<img src="{html.escape(offer.gameinfo.image_url)}" />'
        content += f"<p>{offer.type.value} found."
        if offer.url:
            content += f' Claim it on <a href="{html.escape(offer.url)}">{html.escape(offer.source.value)}</a>.'
        content += "</p>"
        content += "<ul>"
        if offer.valid_from:
            content += f"<li><b>Valid from:</b> {offer.valid_from.strftime(TIMESTAMP_READABLE_WITH_HOUR)}</li>"
        else:
            content += f"<li><b>Valid from:</b> {offer.seen_first.strftime(TIMESTAMP_READABLE_WITH_HOUR)}</li>"
        if offer.valid_to:
            content += f"<li><b>Valid to:</b> {offer.valid_to.strftime(TIMESTAMP_READABLE_WITH_HOUR)}</li>"
        content += "</ul>"
        if offer.gameinfo:
            if offer.type == OfferType.GAME:
                content += f"<p>About {html.escape(offer.gameinfo.name)}:</p>"
            elif offer.type == OfferType.LOOT:
                content += f"<p>This loot probably belongs to {html.escape(offer.gameinfo.name)}:</p>"
            content += "<ul>"
            links = []
            if offer.gameinfo.steam_url:
                links.append(
                    f'<a href="{html.escape(offer.gameinfo.steam_url)}">Steam shop</a>'
                )
            if offer.gameinfo.igdb_url:
                links.append(
                    f'<a href="{html.escape(offer.gameinfo.igdb_url)}">IGDB</a>'
                )
            if len(links) > 0:
                content += f"<li><b>Links:</b> {' / '.join(links)}</li>"

            if offer.gameinfo.short_description:
                content += f"<li><b>Description:</b> {html.escape(offer.gameinfo.short_description)}</li>"
            if offer.gameinfo.genres:
                content += f'<li><b>Genres:</b> {html.escape(", ".join(offer.gameinfo.genres))}</li>'
            if offer.gameinfo.release_date:
                content += f"<li><b>Release date:</b> {html.escape(offer.gameinfo.release_date.strftime(TIMESTAMP_READABLE_WITH_HOUR))}</li>"
            if offer.gameinfo.recommended_price_eur:
                content += f"<li><b>Recommended price:</b> {offer.gameinfo.recommended_price_eur} EUR</li>"

            ratings = []
            if offer.gameinfo.metacritic_score and offer.gameinfo.metacritic_url:
                ratings.append(
                    f'<a href="{html.escape(offer.gameinfo.metacritic_url)}">Metacritic {offer.gameinfo.metacritic_score} %</a>'
                )
            elif offer.gameinfo.metacritic_score:
                ratings.append(f"Metacritic {offer.gameinfo.metacritic_score} %")
            if offer.gameinfo.igdb_meta_ratings and offer.gameinfo.igdb_meta_score:
                ratings.append(
                    f"IGDB Meta {offer.gameinfo.igdb_meta_score} % ({offer.gameinfo.igdb_meta_ratings} sources)"
                )
            if offer.gameinfo.igdb_user_ratings and offer.gameinfo.igdb_user_score:
                ratings.append(
                    f"IGDB User {offer.gameinfo.igdb_user_score} % ({offer.gameinfo.igdb_user_ratings} sources)"
                )
            if (
                offer.gameinfo.steam_percent
                and offer.gameinfo.steam_score
                and offer.gameinfo.steam_recommendations
            ):
                ratings.append(
                    f"Steam {offer.gameinfo.steam_percent} % ({offer.gameinfo.steam_score}/10, {offer.gameinfo.steam_recommendations} recommendations)"
                )
            if len(ratings) > 0:
                content += f"<li><b>Ratings:</b> {' / '.join(ratings)}</li>"

            content += "</ul>"

        content += f"<p><small>Source: {html.escape(offer.source.value)}, Seen first: {offer.seen_first.strftime(TIMESTAMP_LONG)}</small></p>"
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

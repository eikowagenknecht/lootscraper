# mypy: ignore-errors
import html
from datetime import datetime
from pathlib import Path

from feedgen.feed import FeedGenerator
from pytz import timezone

from app.configparser import Config

from .common import TIMESTAMP_LONG, LootOffer


def generate_feed(offers: list[LootOffer]) -> None:
    last_updated = datetime.now()
    local_timezone = timezone("Europe/Berlin")
    last_updated = last_updated.replace(tzinfo=local_timezone)

    # Generate Feed Info
    # See http://www.atomenabled.org/developers/syndication/#requiredFeedElements
    feed_generator = FeedGenerator()
    # XML
    feed_generator.language("en")
    # Atom Needed
    feed_generator.id("https://phenx.de/loot")
    feed_generator.title("Free Games and Loot Feed - phenx.de")
    feed_generator.updated(last_updated)
    # Atom Recommended
    feed_generator.link(rel="self", href="https://feed.phenx.de/gameloot.xml")
    feed_generator.link(rel="alternate", href="https://phenx.de/loot")
    feed_generator.author(
        {
            "name": "Eiko Wagenknecht",
            "email": "feed@ew-mail.de",
            "uri": "eiko-wagenknecht.de",
        }
    )
    # Atom Optional
    # - Category
    # - Contributor
    # - Generator
    # - Icon
    # - Logo
    # - Rights
    # - Subtitle

    for offer in offers:
        feed_entry = feed_generator.add_entry()
        # Atom Needed
        feed_entry.id(f"https://phenx.de/loot/{offer.id}")
        title = f"{offer.type}: {offer.title}"
        if offer.subtitle:
            title += f" - {offer.subtitle}"
        feed_entry.title(title)
        feed_entry.updated(offer.seen_last.replace(tzinfo=local_timezone))
        # Atom Recommended
        # - Author
        feed_entry.author(
            {
                "name": "Eiko Wagenknecht",
                "email": "feed@ew-mail.de",
                "uri": "eiko-wagenknecht.de",
            }
        )
        # - Content
        feed_entry.content(
            (
                f"<h1>{html.escape(offer.type)}: {html.escape(title)}</h1>"
                "<ul>"
                f"<li>Publisher: {html.escape(offer.publisher)}</li>"
                f"<li>Valid until: {html.escape(offer.enddate)}</li>"
                f"<li>Seen first: {offer.seen_first.strftime(TIMESTAMP_LONG)}</li>"
                f"<li>Seen last: {offer.seen_last.strftime(TIMESTAMP_LONG)}</li>"
                f'<li>Source: <a href="{html.escape(offer.url)}">{html.escape(offer.source)}</a></li>'
                "</ul>"
            ),
            type="xhtml",
        )
        # - Link
        feed_entry.link(rel="alternate", href=offer.url)
        # - Summary
        # Atom Optional
        # - category
        # - contributor
        # - published
        feed_entry.published(offer.seen_first.replace(tzinfo=local_timezone))
        # - source
        # - rights

        # feed_entry.link(href="http://lernfunk.de/feed")

    out_file = Config.data_path() / Path(Config.config()["common"]["FeedFile"])

    # Write the ATOM feed to a file
    feed_generator.atom_file(filename=str(out_file), pretty=True)

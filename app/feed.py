# mypy: ignore-errors
from datetime import datetime
from pathlib import Path

from feedgen.feed import FeedGenerator
from pytz import timezone

from app.config.config import DATA_PATH, FEED_FILE

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
        feed_entry.id(str(offer.id))
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
                f"<h1>{offer.title}</h1>"
                f"<h2>{offer.subtitle}</h2>"
                "<ul>"
                f"<li>Type: {offer.type}</li>"
                f"<li>Publisher: {offer.publisher}</li>"
                f"<li>Valid until: {offer.enddate}</li>"
                f'<li>Source: <a href="{offer.url}">"{offer.source}"</a></li>'
                f"<li>Seen: {offer.seen_first.strftime(TIMESTAMP_LONG)} - {offer.seen_last.strftime(TIMESTAMP_LONG)}</li>"
                "</ul>"
            ),
            type="html",
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

    out_file = Path(DATA_PATH) / Path(FEED_FILE)

    # Write the ATOM feed to a file
    feed_generator.atom_file(filename=str(out_file), pretty=True)

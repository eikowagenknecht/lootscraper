# mypy: ignore-errors
import html
from datetime import datetime, timezone
from pathlib import Path

from feedgen.feed import FeedGenerator

from .common import TIMESTAMP_LONG, TIMESTAMP_READABLE_WITH_HOUR, LootOffer


def generate_feed(offers: list[LootOffer], out_file: Path) -> None:
    last_updated = datetime.now(timezone.utc)

    # Generate Feed Info
    # See http://www.atomenabled.org/developers/syndication/#requiredFeedElements
    feed_generator = FeedGenerator()
    # XML
    feed_generator.language("en")
    # Atom Needed
    if out_file.name == "gameloot.xml":
        feed_generator.id("https://phenx.de/loot")
        feed_generator.title("Free Games and Loot")
    else:
        # Use the part between "gameloot_" and ".xml" as the feed id
        subfeed = out_file.name.split("_", 1)[1][0:-4]
        feed_generator.id("https://phenx.de/loot/" + subfeed)
        feed_generator.title("Free Offers: " + subfeed.replace("_", " / ").title())
    feed_generator.updated(last_updated)
    # Atom Recommended
    feed_generator.link(rel="self", href="https://feed.phenx.de/" + out_file.name)
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
        if offer.valid_from and offer.valid_from > offer.seen_last:
            # Skip future entries and entries that are no longer seen on valid_from date
            continue

        feed_entry = feed_generator.add_entry()
        # Atom Needed
        feed_entry.id(f"https://phenx.de/loot/{int(offer.id)}")
        title = f"{offer.source} - {offer.title}"
        if offer.subtitle:
            title += f": {offer.subtitle}"
        title += f" ({offer.type})"
        feed_entry.title(title)
        feed_entry.updated(offer.seen_first)
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
        content = f"<p>{offer.type} found."
        if offer.img_url:
            content += f'</p><img src="{html.escape(offer.img_url)}" /><p>'
        if offer.url:
            content += f' Claim it here: <a href="{html.escape(offer.url)}">{html.escape(offer.source)}</a>.'
        content += "</p><ul>"
        if offer.valid_from:
            content += f"<li>Valid from: {html.escape(offer.valid_from.strftime(TIMESTAMP_READABLE_WITH_HOUR))}</li>"
        else:
            content += f"<li>Valid from: {html.escape(offer.seen_first.strftime(TIMESTAMP_READABLE_WITH_HOUR))}</li>"
        if offer.valid_to:
            content += f"<li>Valid to: {html.escape(offer.valid_to.strftime(TIMESTAMP_READABLE_WITH_HOUR))}</li>"
        if offer.publisher:
            content += f"<li>Publisher: {html.escape(offer.publisher)}</li>"
        content += "</ul><p>"
        content += f"<small>Source: {html.escape(offer.source)}, Seen first: {offer.seen_first.strftime(TIMESTAMP_LONG)}</small>"
        content += "</p>"
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

    # Write the ATOM feed to a file
    feed_generator.atom_file(filename=str(out_file), pretty=True)

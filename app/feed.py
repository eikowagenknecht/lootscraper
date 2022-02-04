from datetime import datetime

from feedgen.feed import FeedGenerator
from pytz import timezone

from .common import LootOffer


def generate_feed(offers: list[LootOffer], docker: bool) -> None:
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
            "email": "rss@ew-mail.de",
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
    # feed_generator.subtitle('This is a cool feed!')

    entry_id = 1000
    for offer in offers:
        entry_id = entry_id + 1
        feed_entry = feed_generator.add_entry()
        # Atom Needed
        feed_entry.id(str(entry_id))
        feed_entry.title(offer.source + ": " + offer.type + " - " + offer.title)
        feed_generator.updated(last_updated)
        # Atom Recommended
        feed_generator.link()
        # - Author
        # - Content
        # - Link
        # - Summary
        # feed_entry.summary("xxx")
        # Atom Optional
        # - category
        # - contributor
        # - published
        # - source
        # - rights

        feed_entry.content(
            f"""<p>Title: {offer.title}</p>
            <p>Subtitle: {offer.subtitle}</p>
            <p>Publisher: {offer.publisher}</p>
            <p>Valid until: {offer.enddate}</p>
        """,
            type="html",
        )
        # feed_entry.link(href="http://lernfunk.de/feed")

    outputfile = "/data/gameloot.xml" if docker else "data/gameloot.xml"
    feed_generator.atom_file(outputfile)  # Write the ATOM feed to a file

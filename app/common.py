from dataclasses import dataclass
from datetime import datetime
from enum import Enum

TIMESTAMP_SHORT = "%Y-%m-%d"
TIMESTAMP_LONG = "%Y-%m-%d %H:%M:%S"
TIMESTAMP_READABLE_WITH_HOUR = "%a, %d %b %H:%M (UTC)"


class OfferType(Enum):
    """TODO: The value is used in the database, switch to the name instead"""

    LOOT = "Loot"
    GAME = "Game"


class Source(Enum):
    """TODO: The value is used in the database, switch to the name instead"""

    AMAZON = "Amazon Prime"
    EPIC = "Epic Games"


@dataclass
class LootOffer:
    """Represents a database entry in the "loot" table"""

    source: Source
    type: OfferType
    id: int | None = None
    seen_first: datetime | None = None
    seen_last: datetime | None = None
    title: str | None = None
    subtitle: str | None = None
    publisher: str | None = None
    valid_from: datetime | None = None
    valid_to: datetime | None = None
    rawtext: str | None = None
    url: str | None = None
    img_url: str | None = None


# def get_shortname(source: Source) -> str:
#     if source == Source.AMAZON:
#         return "amazon"
#     elif source == Source.EPIC:
#         return "epic"
#     else:
#         raise ValueError("Unknown Scraper")


# def get_longname(source: Source) -> str:
#     if source == Source.AMAZON:
#         return "Amazon Prime"
#     elif source == Source.EPIC:
#         return "Epic Games"
#     else:
#         raise ValueError("Unknown Scraper")


# def get_source(longname: str) -> Source:
#     if longname == "Amazon Prime":
#         return Source.AMAZON
#     elif longname == "Epic Games":
#         return Source.EPIC
#     else:
#         raise ValueError("Unknown Scraper")

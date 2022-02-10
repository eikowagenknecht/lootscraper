from dataclasses import dataclass
from enum import Enum

DATEFORMAT = "%Y-%m-%d"


class OfferType(Enum):
    LOOT = "Loot"
    GAME = "Game"


@dataclass
class LootOffer:
    """Represents a database entry in the "loot" table"""

    id: int | None = None
    first_scraped_date: str | None = None
    last_scraped_date: str | None = None
    source: str | None = None
    type: str | None = None
    title: str | None = None
    subtitle: str | None = None
    publisher: str | None = None
    enddate: str | None = None
    rawtext: str | None = None

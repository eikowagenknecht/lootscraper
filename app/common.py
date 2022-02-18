from dataclasses import dataclass
from datetime import datetime
from enum import Enum

TIMESTAMP_SHORT = "%Y-%m-%d"
TIMESTAMP_LONG = "%Y-%m-%d %H:%M:%S"


class OfferType(Enum):
    LOOT = "Loot"
    GAME = "Game"


@dataclass
class LootOffer:
    """Represents a database entry in the "loot" table"""

    id: int | None = None
    seen_first: datetime | None = None
    seen_last: datetime | None = None
    source: str | None = None
    type: str | None = None
    title: str | None = None
    subtitle: str | None = None
    publisher: str | None = None
    enddate: str | None = None
    rawtext: str | None = None
    url: str | None = None
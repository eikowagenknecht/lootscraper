from enum import Enum

TIMESTAMP_SHORT = "%Y-%m-%d"
TIMESTAMP_LONG = "%Y-%m-%d %H:%M:%S"
TIMESTAMP_READABLE_WITH_HOUR = "%Y-%m-%d - %H:%M UTC"


class OfferType(Enum):
    LOOT = "Loot"
    GAME = "Game"


class Source(Enum):
    AMAZON = "Amazon Prime"
    EPIC = "Epic Games"
    STEAM = "Steam"
    GOG = "GOG"

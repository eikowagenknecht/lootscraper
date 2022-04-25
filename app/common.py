from enum import Enum

TIMESTAMP_SHORT = "%Y-%m-%d"
TIMESTAMP_LONG = "%Y-%m-%d %H:%M:%S"
TIMESTAMP_READABLE_WITH_HOUR = "%Y-%m-%d - %H:%M UTC"


class OfferType(Enum):
    LOOT = "Loot"  # DLC, Ingame cash, etc.
    GAME = "Game"


class Source(Enum):
    AMAZON = "Amazon Prime"
    EPIC = "Epic Games"
    STEAM = "Steam"
    GOG = "GOG"


class Channel(Enum):
    ALL = "All"
    FEED = "Feed"
    TELEGRAM = "Telegram"


def chunkstring(string: str, length: int) -> list[str]:
    """Split a string into chunks of the given length (last chunk may be shorter)."""
    chunk_iterator = (string[0 + i : length + i] for i in range(0, len(string), length))
    return list(chunk_iterator)

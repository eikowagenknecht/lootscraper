from enum import Enum

TIMESTAMP_SHORT = "%Y-%m-%d"
TIMESTAMP_LONG = "%Y-%m-%d %H:%M:%S"
TIMESTAMP_READABLE_WITH_HOUR = "%Y-%m-%d - %H:%M UTC"


class OfferType(Enum):
    GAME = "Game"
    LOOT = "Loot"  # DLC, Ingame cash, etc.


class Source(Enum):
    APPLE = "Apple App Store"
    AMAZON = "Amazon Prime"
    EPIC = "Epic Games"
    GOG = "GOG"
    HUMBLE = "Humble Bundle"
    ITCH = "itch.io"
    STEAM = "Steam"


class Channel(Enum):
    ALL = "All"
    FEED = "Feed"
    TELEGRAM = "Telegram"


class OfferDuration(Enum):
    ALWAYS = "Always Free"  # These probably will stay free forever
    CLAIMABLE = "Permanent after Claim"  # The usual offers (Epic etc.)
    TEMPORARY = "Temporary"  # Temporary offers (Steam weekend etc.)


def chunkstring(string: str, length: int) -> list[str]:
    """Split a string into chunks of the given length (last chunk may be shorter)."""
    chunk_iterator = (string[0 + i : length + i] for i in range(0, len(string), length))
    return list(chunk_iterator)


def markdown_escape(input: str) -> str:
    return (
        input.replace("\\", "\\\\")
        .replace("_", "\\_")
        .replace("*", "\\*")
        .replace("[", "\\[")
        .replace("]", "\\]")
        .replace("(", "\\(")
        .replace(")", "\\)")
        .replace("~", "\\~")
        .replace("`", "\\`")
        .replace(">", "\\>")
        .replace("#", "\\#")
        .replace("+", "\\+")
        .replace("-", "\\-")
        .replace("=", "\\=")
        .replace("|", "\\|")
        .replace("{", "\\{")
        .replace("}", "\\}")
        .replace(".", "\\.")
        .replace("!", "\\!")
    )


def markdown_unescape(input: str) -> str:
    return (
        input.replace("\\_", "_")
        .replace("\\*", "*")
        .replace("\\[", "[")
        .replace("\\]", "]")
        .replace("\\(", "(")
        .replace("\\)", ")")
        .replace("\\~", "~")
        .replace("\\`", "`")
        .replace("\\>", ">")
        .replace("\\#", "#")
        .replace("\\+", "+")
        .replace("\\-", "-")
        .replace("\\=", "=")
        .replace("\\|", "|")
        .replace("\\{", "{")
        .replace("\\}", "}")
        .replace("\\.", ".")
        .replace("\\!", "!")
        .replace("\\\\", "\\")
    )


def markdown_url(url: str, text: str) -> str:
    return Rf"[{markdown_escape(markdown_unescape(text))}]({markdown_escape(url)})"


def markdown_bold(text: str) -> str:
    return f"*{markdown_escape(text)}*"

import difflib
import re
from datetime import datetime, timedelta, timezone
from typing import Any

from lootscraper.common import OfferType

RESULT_MATCH_THRESHOLD = 0.85


def get_match_score(search: str, result: str) -> float:
    # Only keep alphanimeric characters and condense spaces to one
    cleaned_search = re.sub(r"[^a-zA-Z0-9 ]", "", search)
    cleaned_search = re.sub(" +", " ", cleaned_search).lower()

    cleaned_result = re.sub(r"[^a-zA-Z0-9 ]", "", result)
    cleaned_result = re.sub(" +", " ", cleaned_result).lower()

    score = difflib.SequenceMatcher(a=cleaned_search, b=cleaned_result).ratio()

    if score < RESULT_MATCH_THRESHOLD:
        # If it is no match, look for a partial match instead. Look at the
        # first x or last x words from the result because the result often
        # includes additional text (e.g. a prepended "Tom Clancy's ...") or
        # an appended " - Ultimate edition". x is the number of words the
        # search term has.

        words_result = cleaned_result.split(" ")
        words_searchstring = cleaned_search.split(" ")

        score = max(
            score,
            difflib.SequenceMatcher(
                a=cleaned_search,
                b=" ".join(words_result[: len(words_searchstring)]).lower(),
            ).ratio(),
        )
        score = max(
            score,
            difflib.SequenceMatcher(
                a=cleaned_search,
                b=" ".join(words_result[-len(words_searchstring) :]).lower(),
            ).ratio(),
        )

        # This score needed some help, there is a small penalty for it, so for example
        # Cities: Skylines is preferred over
        # Cities: Skylines - One more DLC
        score -= 0.01

    return score


def clean_nones(value: dict[str, Any]) -> dict[str, Any]:
    """
    Recursively remove all None values from dictionaries and lists.

    Returns the result as a new dictionary or list.
    """
    if isinstance(value, list):
        return [clean_nones(x) for x in value if x is not None]

    if isinstance(value, dict):
        return {key: clean_nones(val) for key, val in value.items() if val is not None}

    return value


def clean_title(title: str, type_: OfferType) -> str:
    """Cleans the title of an offer. This is different for games and loot.
    For games, we remove some common parts of the title that are not needed.
    """
    if type_ == OfferType.GAME:
        return clean_game_title(title)

    if type_ == OfferType.LOOT:
        # The second element is the full offer title
        return clean_combined_title(title)[1]

    raise ValueError(f"Unknown type {type_}")


def clean_game_title(title: str) -> str:
    return (
        title.replace("\n", "")
        .replace(" - ", ": ")
        .replace(" : ", ": ")
        .strip()
        .removeprefix("[VIP]")
        .removeprefix("[ VIP ]")
        .removesuffix(" on Origin")
        .removesuffix(" Game of the Year Edition Deluxe")
        .removesuffix(" Game of the Year Edition")
        .removesuffix(" Definitive Edition")
        .removesuffix(" Deluxe Edition")
        .removesuffix(" (Mobile)")
        .strip()
        .removesuffix(":")
        .removesuffix("-")
        .strip()
    )


def clean_loot_title(title: str) -> str:
    return (
        title.replace("\n", "")
        .replace(" - ", ": ")
        .replace(" : ", ": ")
        .strip()
        .removesuffix(":")
        .removesuffix("-")
        .strip()
    )


def clean_combined_title(title: str) -> tuple[str, str]:
    """
    Clean the combined title.

    Unfortunately loot offers come in free text format, so we need to do some
    manual matching.

    Most of the time, it is the part before the first ": ", e.g.
        "Lords Mobile: Warlord Pack"
        -> Lords Mobile

    When the title itself contains a ": ", it can also be the second, e.g.
        "Mobile Legends: Bang Bang: Amazon Prime Chest"
        -> Mobile Legends: Bang Bang

    Sometimes it also ist "Get ... in [Game]", e.g.
        "Get up to GTA$400,000 this month in GTA Online"
        -> GTA Online

    We use the same method for Steam loot offers for now as they also seem to
    be seperated in the same fashion.

    Sometimes Steam uses " — " (warning: this is a special unicode character)
    for the separation of game and loot name and the loot itself also
    contains a ": ". In this case, we can just use the part before the " — "
    as the game name, e.g.
        "World of Warships — Starter Pack: Dreadnought"
        -> World of Warships: Starter Pack

    So as a general rule, we try splitting in this order:
    1. Special Steam format (TITLE — LOOT: LOOTDETAIL)
    2. By the second colon (TITLE: TITLEDETAIL: LOOTDETAIL)
    3. By the "Get ... in [Game] pattern" (to catch games with a colon
    in the name)
    4. By the ": " pattern (TITLE: LOOT)
    """
    probable_game_name: str = ""
    probable_loot_name: str = ""

    title = title.replace("\n", " ").strip()

    # Special Steam format (TITLE — LOOT: LOOTDETAIL)
    match = re.compile(r"(.*) — (.*: .*)").match(title)
    if match and match.group(1):
        probable_game_name = match.group(1)
        probable_loot_name = match.group(2)
    # By the second colon (TITLE: TITLEDETAIL: LOOTDETAIL)
    if not probable_game_name:
        # Replace some very special characters that Steam uses sometimes
        title = title.replace("：", ": ").replace(" — ", ": ").replace(" - ", ": ")  # noqa
        title_parts: list[str] = title.split(": ")
    if not probable_game_name and len(title_parts) >= 3:
        probable_game_name = ": ".join(title_parts[:-1])
        probable_loot_name = title_parts[-1]
    # By the "Get ... in [Game] pattern" (to catch games with a colon in the name)
    if not probable_game_name:
        match = re.compile(r"Get (.*) in (.*)").match(title)
        if match and match.group(1):
            probable_game_name = match.group(2)
            probable_loot_name = match.group(1)
    # By the ": " pattern (TITLE: LOOT)
    if not probable_game_name and len(title_parts) == 2:
        probable_game_name = ": ".join(title_parts[:-1])
        probable_loot_name = title_parts[-1]
    # If we still don't have a game name, we just use the whole title
    if not probable_game_name:
        probable_game_name = title

    probable_game_name = clean_game_title(probable_game_name)

    # Capitalize first letter
    probable_loot_name = probable_loot_name.strip()
    probable_loot_name = probable_loot_name[:1].upper() + probable_loot_name[1:]

    # Return the cleaned game and loot name. For clarity, we will use
    # the format "Game: Loot" for the offer title.

    resulting_offer_title = probable_game_name
    if probable_loot_name:
        resulting_offer_title += f" - {probable_loot_name}"

    # Return both the cleaned game name and the resulting offer title
    return (probable_game_name, resulting_offer_title)


def calc_real_valid_to(
    seen_last: datetime,
    valid_to: datetime | None,
    *,
    forced_now: datetime | None = None,
) -> datetime | None:
    """Calculate the real end date of an offer."""
    now = forced_now if forced_now is not None else datetime.now(tz=timezone.utc)

    if valid_to is None:
        # The offer has no end date and hasn't been seen for more than a day.
        if now > (seen_last + timedelta(days=1)):
            return seen_last
        # The offer has no end date and is still there. So we know nothing.
        return None

    # The offer had an end date but hasn't been seen for more than an hour.
    if valid_to > (seen_last + timedelta(hours=1)):
        # The offer has been seen in the last day, we don't force end it yet.
        # Maybe the site ist just down for a while.
        if now < (seen_last + timedelta(days=1)):
            return valid_to

        # The offer has not been seen in the last day. It's probably gone.
        # So the real end date is the last time we saw it.
        return seen_last

    # The offer should have ended, but it's still there. So we approximate the
    # end date by adding 1 hour to the last time we saw it.
    if valid_to < seen_last:
        return seen_last + timedelta(hours=1)

    # In all other cases, we believe what the offer says.
    return valid_to

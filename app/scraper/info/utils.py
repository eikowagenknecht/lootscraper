import difflib
import re
from typing import Any

from app.common import OfferType

RESULT_MATCH_THRESHOLD = 0.85


def get_match_score(search: str, result: str) -> float:
    # Only keep alphanimeric characters and condense spaces to one
    cleaned_search = re.sub(r"[^a-zA-Z0-9 ]", "", search)
    cleaned_search = re.sub(" +", " ", cleaned_search).lower()

    cleaned_result = re.sub(r"[^a-zA-Z0-9 ]", "", result)
    cleaned_result = re.sub(" +", " ", cleaned_result).lower()

    score = difflib.SequenceMatcher(a=cleaned_search, b=cleaned_result).ratio()

    if score < RESULT_MATCH_THRESHOLD:
        # If it is no match, look for a partial match instead. Look at the first x or last x words from the
        # result because the result often includes additional text (e.g. a prepended "Tom Clancy's ...") or
        # an appended " - Ultimate edition". x is the number of words the search term has.

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
    Recursively remove all None values from dictionaries and lists, and returns
    the result as a new dictionary or list.
    """
    if isinstance(value, list):
        return [clean_nones(x) for x in value if x is not None]

    if isinstance(value, dict):
        return {key: clean_nones(val) for key, val in value.items() if val is not None}

    return value


def clean_title(title: str, type_: OfferType) -> str:
    if type_ == OfferType.GAME:
        return clean_game_title(title)

    if type_ == OfferType.LOOT:
        return clean_loot_title(title)

    raise ValueError(f"Unknown type {type_}")


def clean_game_title(title: str) -> str:
    probable_game_name: str | None = None

    probable_game_name = (
        title.removesuffix(" on Origin")
        .removesuffix(" Game of the Year Edition Deluxe")
        .removesuffix(" Game of the Year Edition")
        .removesuffix(" Definitive Edition")
        .strip()
        .removesuffix(":")
        .removesuffix("-")
        .strip()
    )

    return probable_game_name


def clean_loot_title(title: str) -> str:
    """
    Unfortunately Amazon loot offers come in free text format, so we
    need to do some manual matching.

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

    probable_game_name: str | None = None

    match = re.compile(r"(.*) — .*: .*").match(title)
    if match and match.group(1):
        probable_game_name = match.group(1)
    if probable_game_name is None:
        # Replace some very special characters that Steam uses sometimes
        title = title.replace("：", ": ").replace(" — ", ": ").replace(" - ", ": ")
        title_parts: list[str] = title.split(": ")
    if probable_game_name is None and len(title_parts) >= 3:
        probable_game_name = ": ".join(title_parts[:-1])
    if probable_game_name is None:
        match = re.compile(r"Get .* in (.*)").match(title)
        if match and match.group(1):
            probable_game_name = match.group(1)
    if probable_game_name is None and len(title_parts) == 2:
        probable_game_name = ": ".join(title_parts[:-1])
    if probable_game_name is None:
        probable_game_name = title

    return clean_game_title(probable_game_name)

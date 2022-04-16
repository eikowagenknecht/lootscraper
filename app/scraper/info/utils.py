import difflib
import re
from typing import Any

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
    elif isinstance(value, dict):
        return {key: clean_nones(val) for key, val in value.items() if val is not None}
    else:
        return value

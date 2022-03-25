import difflib
import json
import logging
from datetime import datetime, timezone

import requests
from igdb.wrapper import IGDBWrapper

from app.configparser import Config
from app.scraper.info.gameinfo import Gameinfo

RESULT_MATCH_THRESHOLD = 0.85


def get_possible_igdb_id(search_string: str) -> int:
    igdb = get_igdb_wrapper()
    if igdb is None:
        return 0

    raw_response: bytes = igdb.api_request(
        "games",
        f'search "{search_string}"; fields name; where version_parent = null; limit 50;',
    )

    response = json.loads(raw_response)

    # Read all results and use the one with the highest difflib score (lower cased!)
    best_id: int | None = None
    best_score: float = 0
    best_title: str | None = None

    for entry in response:
        result_name = entry["name"]
        score = get_match_score(search_string, result_name)

        if score >= RESULT_MATCH_THRESHOLD and score > best_score:
            best_id = entry["id"]
            best_score = score
            best_title = result_name
            logging.debug(
                f"IGDB: Found match {result_name} with a score of {(score*100):.0f} %"
            )
        else:
            logging.debug(
                f"IGDB: Ignoring {result_name} as it's score of {(score*100):.0f} % is too low"
            )

    if best_id is not None:
        logging.info(
            f"IGDB: Search for {search_string} resulted in {best_title} ({best_id}) as the best match with a score of {(best_score*100):.0f} %"
        )
        return best_id

    logging.info(f"IGDB: Search for {search_string} found no result")

    return 0


def get_igdb_details(search_string: str) -> Gameinfo | None:
    logging.info(f"IGDB: Reading details for {search_string}")
    igdb = get_igdb_wrapper()
    if igdb is None:
        return None

    game_id = get_possible_igdb_id(search_string)
    if game_id == 0:
        return None

    raw_response: bytes = igdb.api_request(
        "games",
        f"fields *; where id = {game_id};",
    )

    response = json.loads(raw_response)

    if len(response) == 0:
        return None

    result: Gameinfo = Gameinfo()

    try:
        result.name = response[0]["name"]
    except KeyError:
        pass

    try:
        result.igdb_url = response[0]["url"]
    except KeyError:
        pass

    try:
        result.short_description = response[0]["summary"]
    except KeyError:
        pass

    try:
        result.idgb_id = response[0]["id"]
    except KeyError:
        pass

    try:
        unix_releasedate = response[0]["first_release_date"]
        timestamp = datetime.utcfromtimestamp(unix_releasedate)
        result.release_date = timestamp.replace(tzinfo=timezone.utc)
    except KeyError:
        pass

    try:
        result.igdb_user_score = response[0]["rating"]
    except KeyError:
        pass

    try:
        result.igdb_user_ratings = response[0]["rating_count"]
    except KeyError:
        pass

    try:
        result.igdb_meta_score = response[0]["aggregated_rating"]
    except KeyError:
        pass

    try:
        result.igdb_meta_ratings = response[0]["aggregated_rating_count"]
    except KeyError:
        pass

    # TODO:
    # genres = List of genres (ids only, have to be called separately)
    # cover = Cover image of the game (id only)

    return result


# TODO: Only use one connection, rate limit to < 4 per second
def get_igdb_wrapper() -> IGDBWrapper | None:
    client_id = Config.config()["igdb"]["ClientId"]
    client_secret = Config.config()["igdb"]["ClientSecret"]

    r = requests.post(
        f"https://id.twitch.tv/oauth2/token?client_id={client_id}&client_secret={client_secret}&grant_type=client_credentials"
    )
    if r._content is None:
        return None
    access_token = json.loads(r._content)["access_token"]

    wrapper = IGDBWrapper(client_id, access_token)

    return wrapper


def get_match_score(search: str, result: str) -> float:
    cleaned_search = (
        search.replace("™", "")
        .replace("©", "")
        .replace("®", "")
        .replace(":", "")
        .replace("  ", " ")
    ).lower()

    cleaned_result = (
        result.replace("™", "")
        .replace("©", "")
        .replace("®", "")
        .replace(":", "")
        .replace("  ", " ")
    ).lower()

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

        # This score needed some help, there is a penalty for it
        score -= 0.1

    return score

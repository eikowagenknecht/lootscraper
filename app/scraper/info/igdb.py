import json
import logging
from datetime import datetime, timezone
import re
import requests
from igdb.wrapper import IGDBWrapper

from app.configparser import Config
from app.scraper.info.utils import RESULT_MATCH_THRESHOLD, get_match_score
from app.sqlalchemy import IgdbInfo


def get_igdb_id(search_string: str) -> int | None:
    igdb = get_igdb_wrapper()

    logging.info(f"Getting id for {search_string}")

    api_search_string = re.sub(
        r"[^\x00-\x7F\x80-\xFF\u0100-\u017F\u0180-\u024F\u1E00-\u1EFF]",
        "",
        search_string,
    )
    raw_response: bytes = igdb.api_request(
        "games",
        f'search "{api_search_string}"; fields name; where version_parent = null; limit 50;',
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

    return None


def get_igdb_details(
    id: int | None = None, title: str | None = None
) -> IgdbInfo | None:
    igdb_game_id: int | None = None

    if id:
        igdb_game_id = id

    if not igdb_game_id and title:
        igdb_game_id = get_igdb_id(title)

    if not igdb_game_id:
        # No entry found, not adding any data
        return None

    logging.info(f"IGDB: Reading details for IGDB id {id}")

    igdb_info = IgdbInfo()
    igdb_info.id = igdb_game_id

    igdb = get_igdb_wrapper()
    raw_response: bytes = igdb.api_request(
        "games",
        f"fields *; where id = {igdb_game_id};",
    )

    response = json.loads(raw_response)

    if len(response) == 0:
        return None

    try:
        igdb_info.name = response[0]["name"]
    except KeyError:
        pass

    try:
        igdb_info.url = response[0]["url"]
    except KeyError:
        pass

    try:
        igdb_info.short_description = response[0]["summary"]
    except KeyError:
        pass

    try:
        unix_releasedate = response[0]["first_release_date"]
        timestamp = datetime.utcfromtimestamp(unix_releasedate)
        igdb_info.release_date = timestamp.replace(tzinfo=timezone.utc)
    except KeyError:
        pass

    try:
        igdb_info.user_score = int(response[0]["rating"])
    except (KeyError, ValueError):
        pass

    try:
        igdb_info.user_ratings = response[0]["rating_count"]
    except KeyError:
        pass

    try:
        igdb_info.meta_score = int(response[0]["aggregated_rating"])
    except (KeyError, ValueError):
        pass

    try:
        igdb_info.meta_ratings = response[0]["aggregated_rating_count"]
    except KeyError:
        pass

    # TODO: Publisher, Genres, Cover
    # genres = List of genres (ids only, have to be called separately)
    # cover = Cover image of the game (id only)

    return igdb_info


# TODO: Only use one connection, rate limit to < 4 per second
def get_igdb_wrapper() -> IGDBWrapper:
    client_id = Config.get().igdb_client_id
    client_secret = Config.get().igdb_client_secret

    r = requests.post(
        f"https://id.twitch.tv/oauth2/token?client_id={client_id}&client_secret={client_secret}&grant_type=client_credentials"
    )
    if r._content is None:
        return None
    access_token = json.loads(r._content)["access_token"]

    wrapper = IGDBWrapper(client_id, access_token)

    if wrapper is None:
        raise Exception("Could not get IGDB wrapper")

    return wrapper

import json
import logging
from datetime import datetime, timezone

import requests
from igdb.wrapper import IGDBWrapper
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.configparser import Config
from app.scraper.info.utils import RESULT_MATCH_THRESHOLD, get_match_score
from app.sqlalchemy import Game, Offer


def get_possible_igdb_id(search_string: str) -> int:
    igdb = get_igdb_wrapper()

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


def add_igdb_details(offer: Offer, session: Session) -> None:
    igdb_game_id = get_possible_igdb_id(offer.probable_game_name)

    if igdb_game_id == 0:
        # No entry found, not adding any data
        return

    # Look for existing game
    game: Game | None = session.execute(
        select(Game).where(Game.igdb_id == igdb_game_id)
    ).scalar_one_or_none()

    if game is not None:
        # Use existing game if it exists
        offer.game_id = game.id
        return

    game = Game()
    game.igdb_id = igdb_game_id

    logging.info(f'IGDB: Reading details for offer "{offer.title}"')

    igdb = get_igdb_wrapper()
    raw_response: bytes = igdb.api_request(
        "games",
        f"fields *; where id = {igdb_game_id};",
    )

    response = json.loads(raw_response)

    if len(response) == 0:
        return None

    try:
        game.name = response[0]["name"]
    except KeyError:
        pass

    try:
        game.igdb_url = response[0]["url"]
    except KeyError:
        pass

    try:
        game.short_description = response[0]["summary"]
    except KeyError:
        pass

    try:
        unix_releasedate = response[0]["first_release_date"]
        timestamp = datetime.utcfromtimestamp(unix_releasedate)
        game.release_date = timestamp.replace(tzinfo=timezone.utc)
    except KeyError:
        pass

    try:
        game.igdb_user_score = int(response[0]["rating"])
    except (KeyError, ValueError):
        pass

    try:
        game.igdb_user_ratings = response[0]["rating_count"]
    except KeyError:
        pass

    try:
        game.igdb_meta_score = int(response[0]["aggregated_rating"])
    except (KeyError, ValueError):
        pass

    try:
        game.igdb_meta_ratings = response[0]["aggregated_rating_count"]
    except KeyError:
        pass

    # TODO: Publisher, Genres, Cover
    # genres = List of genres (ids only, have to be called separately)
    # cover = Cover image of the game (id only)


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

from __future__ import annotations

import contextlib
import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import httpx
from unidecode import unidecode

from lootscraper.config import Config
from lootscraper.database import IgdbInfo
from lootscraper.utils import RESULT_MATCH_THRESHOLD, get_match_score

logger = logging.getLogger(__name__)


API_URL = "https://api.igdb.com/v4/"
TOKEN_URL = "https://id.twitch.tv/oauth2/token"  # noqa: S105


@dataclass
class IgdbEntry:
    igdb_id: int
    score: float
    title: str


class IGDBWrapper:
    """Asynchronous IGDB wrapper module for the api v4 with Apicalypse syntax."""

    def __init__(self, client_id: str, client_secret: str) -> None:
        self.client_id = client_id
        self.client_secret = client_secret
        self.auth_token: str | None = None

    async def authorize(self) -> None:
        """Authorize with IGDB and get a token for the session."""
        url = TOKEN_URL
        request_params = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "grant_type": "client_credentials",
        }

        async with httpx.AsyncClient() as client:
            result = await client.post(url, data=request_params)
            result.raise_for_status()
            self.auth_token = result.json()["access_token"]

    async def api_request(
        self,
        endpoint: str,
        query: str,
    ) -> Any:  # noqa: ANN401
        """
        Take an endpoint and the Apicalypse query and return the api
        response as a json object.
        """
        if self.auth_token is None:
            await self.authorize()

        url = f"{API_URL}{endpoint}"
        request_headers = {
            "Client-ID": self.client_id,
            "Authorization": f"Bearer {self.auth_token}",
        }

        async with httpx.AsyncClient() as client:
            result = await client.post(url, headers=request_headers, content=query)
            result.raise_for_status()
            return result.json()


async def get_igdb_id(search_string: str) -> int | None:
    """
    Search IGDB via the APIv4 and return the best match in the results.

    The comparison is done with difflib, lower cased.
    """
    logger.info(f"Getting id for {search_string}")

    # Replace non-Latin characters with their closest representation
    # and replace " because that would break the query
    api_search_string = unidecode(search_string).replace('"', "")

    igdb = IGDBWrapper(Config.get().igdb_client_id, Config.get().igdb_client_secret)

    try:
        response = await igdb.api_request(
            "games",
            f'search "{api_search_string}"; '
            "fields name; "
            "where version_parent = null; "
            "limit 50;",
        )
    except httpx.HTTPError:
        logger.exception("IGDB request failed.")
        return None

    best_match: IgdbEntry | None = None

    for entry in response:
        title = entry["name"]
        score = get_match_score(search_string, title)

        if score >= RESULT_MATCH_THRESHOLD and (
            best_match is None or score > best_match.score
        ):
            best_match = IgdbEntry(entry["id"], score, title)
            logger.debug(f"Found match {title} with a score of {(score * 100):.0f} %.")
        else:
            logger.debug(
                f"Ignoring {title} as it's score of {(score * 100):.0f} % is too low.",
            )

    if best_match is None:
        logger.info(f"Search for {api_search_string} found no result.")
        return None

    logger.info(
        f"{best_match.title} ({best_match.igdb_id}) is the best match "
        f"({(best_match.score * 100):.0f} %).",
    )
    return best_match.igdb_id


async def get_igdb_details(
    id_: int | None = None,
    title: str | None = None,
) -> IgdbInfo | None:
    igdb_game_id: int | None = None

    if id_:
        igdb_game_id = id_

    if not igdb_game_id and title:
        igdb_game_id = await get_igdb_id(title)

    if not igdb_game_id:
        # No entry found
        return None

    logger.info(f"Reading details for IGDB id {id_}")

    igdb_info = IgdbInfo(id=igdb_game_id)

    await add_data_from_api(igdb_info)

    return igdb_info


async def read_data_from_api(igdbid: int) -> list[dict[str, Any]] | None:
    igdb = IGDBWrapper(Config.get().igdb_client_id, Config.get().igdb_client_secret)

    try:
        response = await igdb.api_request(
            "games",
            f"fields *; where id = {igdbid};",
        )
    except httpx.HTTPError:
        logger.exception("IGDB request failed.")
        return None
    else:
        return response


async def add_data_from_api(igdb_info: IgdbInfo) -> None:
    data = await read_data_from_api(igdb_info.id)
    if data is None:
        return

    game = data[0]

    with contextlib.suppress(KeyError):
        igdb_info.name = game["name"]

    with contextlib.suppress(KeyError):
        igdb_info.url = game["url"]

    with contextlib.suppress(KeyError):
        igdb_info.short_description = game["summary"]

    try:
        unix_releasedate = game["first_release_date"]
        timestamp = datetime.fromtimestamp(unix_releasedate, tz=UTC)
        igdb_info.release_date = timestamp.replace(tzinfo=UTC)
    except KeyError:
        pass

    with contextlib.suppress(KeyError, ValueError):
        igdb_info.user_score = int(game["rating"])

    with contextlib.suppress(KeyError):
        igdb_info.user_ratings = game["rating_count"]

    with contextlib.suppress(KeyError, ValueError):
        igdb_info.meta_score = int(game["aggregated_rating"])

    with contextlib.suppress(KeyError):
        igdb_info.meta_ratings = game["aggregated_rating_count"]

    # TODO: Publisher, Genres, Cover
    # genres = List of genres (ids only, have to be called separately)
    # cover = Cover image of the game (id only)

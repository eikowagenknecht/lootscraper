from __future__ import annotations

import dataclasses
import json
from copy import copy
from dataclasses import dataclass
from datetime import datetime

from app.scraper.info.utils import clean_nones


@dataclass
class Gameinfo:
    steam_id: int | None = None
    idgb_id: int | None = None
    name: str | None = None
    short_description: str | None = None
    release_date: datetime | None = None
    recommended_price_eur: float | None = None
    genres: list[str] | None = None
    steam_recommendations: int | None = None
    steam_percent: int | None = None
    steam_score: int | None = None
    igdb_user_score: int | None = None
    igdb_user_ratings: int | None = None
    igdb_meta_score: int | None = None
    igdb_meta_ratings: int | None = None
    igdb_url: str | None = None
    metacritic_score: int | None = None
    metacritic_url: str | None = None
    steam_url: str | None = None
    image_url: str | None = None
    publishers: str | None = None

    @classmethod
    def merge(cls, prio: Gameinfo | None, other: Gameinfo | None) -> Gameinfo | None:
        if prio is None:
            return other
        if other is None:
            return prio

        result = Gameinfo()

        for attr in cls.__dataclass_fields__:
            if getattr(prio, attr) is not None:
                setattr(result, attr, getattr(prio, attr))
            if getattr(other, attr) is not None and getattr(result, attr) is None:
                setattr(result, attr, getattr(other, attr))

        return result

    def to_json(self) -> str:
        if self.release_date is None:
            res_dict = clean_nones(dataclasses.asdict(self))
            res_json = json.dumps(res_dict)
            return res_json

        dumpcopy = copy(self)
        dumpcopy.release_date = self.release_date.isoformat()  # type: ignore

        res_dict = clean_nones(dataclasses.asdict(dumpcopy))
        res_json = json.dumps(res_dict)
        return res_json

    @classmethod
    def from_json(cls, json_str: str) -> Gameinfo:
        input = json.loads(json_str)

        result: Gameinfo = Gameinfo()
        try:
            result.steam_id = input["steam_id"]
        except KeyError:
            pass

        try:
            result.idgb_id = input["idgb_id"]
        except KeyError:
            pass

        try:
            result.name = input["name"]
        except KeyError:
            pass

        try:
            result.short_description = input["short_description"]
        except KeyError:
            pass

        try:
            result.release_date = datetime.fromisoformat(input["release_date"])
        except (KeyError, ValueError, TypeError):
            pass

        try:
            result.recommended_price_eur = float(input["recommended_price_eur"])
        except KeyError:
            pass

        try:
            result.genres = input["genres"]
        except KeyError:
            pass

        try:
            result.steam_recommendations = input["steam_recommendations"]
        except KeyError:
            pass

        try:
            result.steam_percent = input["steam_percent"]
        except KeyError:
            pass

        try:
            result.steam_score = input["steam_score"]
        except KeyError:
            pass

        try:
            result.igdb_user_score = input["igdb_user_score"]
        except KeyError:
            pass

        try:
            result.igdb_user_ratings = input["igdb_user_ratings"]
        except KeyError:
            pass

        try:
            result.igdb_meta_score = input["igdb_meta_score"]
        except KeyError:
            pass

        try:
            result.igdb_meta_ratings = input["igdb_meta_ratings"]
        except KeyError:
            pass

        try:
            result.igdb_url = input["igdb_url"]
        except KeyError:
            pass

        try:
            result.metacritic_score = input["metacritic_score"]
        except KeyError:
            pass

        try:
            result.metacritic_url = input["metacritic_url"]
        except KeyError:
            pass

        try:
            result.steam_url = input["steam_url"]
        except KeyError:
            pass

        try:
            result.image_url = input["image_url"]
        except KeyError:
            pass

        try:
            result.publishers = input["publishers"]
        except KeyError:
            pass

        return result

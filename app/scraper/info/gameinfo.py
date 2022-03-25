from __future__ import annotations

import json
from dataclasses import dataclass


@dataclass
class Gameinfo:
    steam_id: int | None = None
    idgb_id: int | None = None
    name: str | None = None
    short_description: str | None = None
    release_date: str | None = None
    recommended_price: str | None = None
    genres: list[str] | None = None
    recommendations: int | None = None
    rating_percent: int | None = None
    rating_score: int | None = None
    metacritic_score: int | None = None
    metacritic_url: str | None = None
    shop_url: str | None = None
    image_url: str | None = None

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
            result.release_date = input["release_date"]
        except KeyError:
            pass

        try:
            result.recommended_price = input["recommended_price"]
        except KeyError:
            pass

        try:
            result.genres = input["genres"]
        except KeyError:
            pass

        try:
            result.recommendations = input["recommendations"]
        except KeyError:
            pass

        try:
            result.rating_percent = input["rating_percent"]
        except KeyError:
            pass

        try:
            result.rating_score = input["rating_score"]
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
            result.shop_url = input["shop_url"]
        except KeyError:
            pass

        try:
            result.image_url = input["image_url"]
        except KeyError:
            pass

        return result

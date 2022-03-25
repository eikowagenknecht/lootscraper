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
        input = json.loads(json_str)  # type: ignore

        result: Gameinfo = Gameinfo()  # type: ignore
        try:
            result.steam_id = input["steam_id"]  # type: ignore
        except KeyError:
            pass

        try:
            result.idgb_id = input["idgb_id"]  # type: ignore
        except KeyError:
            pass

        try:
            result.name = input["name"]  # type: ignore
        except KeyError:
            pass

        try:
            result.short_description = input["short_description"]  # type: ignore
        except KeyError:
            pass

        try:
            result.release_date = input["release_date"]  # type: ignore
        except KeyError:
            pass

        try:
            result.recommended_price = input["recommended_price"]  # type: ignore
        except KeyError:
            pass

        try:
            result.genres = input["genres"]  # type: ignore
        except KeyError:
            pass

        try:
            result.recommendations = input["recommendations"]  # type: ignore
        except KeyError:
            pass

        try:
            result.rating_percent = input["rating_percent"]  # type: ignore
        except KeyError:
            pass

        try:
            result.rating_score = input["rating_score"]  # type: ignore
        except KeyError:
            pass

        try:
            result.metacritic_score = input["metacritic_score"]  # type: ignore
        except KeyError:
            pass

        try:
            result.metacritic_url = input["metacritic_url"]  # type: ignore
        except KeyError:
            pass

        try:
            result.shop_url = input["shop_url"]  # type: ignore
        except KeyError:
            pass

        try:
            result.image_url = input["image_url"]  # type: ignore
        except KeyError:
            pass

        return result

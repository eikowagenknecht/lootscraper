# mypy: ignore-errors
import html
import logging
from collections.abc import Sequence
from datetime import datetime, timezone
from pathlib import Path

from jinja2 import Template

from lootscraper.database import Game, Offer

from .common import (
    TIMESTAMP_SHORT,
    OfferDuration,
    OfferType,
    Source,
)

logger = logging.getLogger(__name__)

TEMPLATE_STR = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{{ feed.title }}</title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
</head>
<body class="bg-gray-100">
    <div class="container mx-auto p-8">
        <h1 class="text-4xl font-bold mb-4">{{ feed.title }}</h1>

        {% for entry in entries|sort(attribute='valid_from', reverse=true) %}

        <!-- Header & Validity -->
        {% if entry.is_expired %}
        <h2 class="flex justify-between items-center text-2xl mb-2 line-through">
        {% else %}
        <h2 class="flex justify-between items-center text-2xl mb-2">
        {% endif %}

        <span class="font-bold">{{ entry.title }}</span>
        {% if entry.valid_from and entry.valid_to %}
        <span class="text-sm">Valid from {{ entry.valid_from }} to {{ entry.valid_to }}</span>
        {% endif %}
        </h2>

        <div class="flex bg-white rounded-lg shadow-md p-6 mb-8">
            <!-- Image -->
            <div>
                {% if entry.img_url %}
                <img src="{{ entry.img_url }}" alt="{{ entry.title }}" class="w-96">
                {% endif %}
            </div>

            <!-- Content -->
            <div class="flex-1 ml-4">

                <!-- Game Info -->
                <div class="bg-gray-200 p-4 rounded-lg text-sm">
                    <div class="flex justify-between mb-2">
                    <h3 class="font-bold underline">
                        {{ entry.game_name }}
                    </h3>
                    {% if entry.release_date %}
                    <span>
                        <strong>Release Date:</strong> {{ entry.release_date }}
                    </span>
                    {% endif %}
                    </div>


                    <!-- Ratings -->
                    <div class="flex flex-wrap mb-2">
                        {% if entry.steam_percent %}
                        <span class="rounded-full px-3 py-1 text-sm font-semibold m-1
                        {% if entry.steam_percent > 90 %}bg-green-700
                        {% elif entry.steam_percent > 80 %}bg-green-500
                        {% elif entry.steam_percent > 60 %}bg-yellow-500
                        {% else %}bg-red-600{% endif %}">
                            Steam: {{ entry.steam_percent }}% / {{ entry.steam_score }} ({{ entry.steam_recommendations }} recommendations)
                        </span>
                        {% endif %}
                        {% if entry.igdb_meta_score %}
                        <span class="rounded-full px-3 py-1 text-sm font-semibold m-1
                        {% if entry.igdb_meta_score > 90 %}bg-green-700
                        {% elif entry.igdb_meta_score > 80 %}bg-green-500
                        {% elif entry.igdb_meta_score > 60 %}bg-yellow-500
                        {% else %}bg-red-600{% endif %}">
                            IGDB Meta: {{ entry.igdb_meta_score }}% ({{ entry.igdb_meta_ratings }} sources)
                        </span>
                        {% endif %}
                        {% if entry.metacritic_score %}
                        <span class="rounded-full px-3 py-1 text-sm font-semibold m-1
                        {% if entry.metacritic_score > 90 %}bg-green-700
                        {% elif entry.metacritic_score > 80 %}bg-green-500
                        {% elif entry.metacritic_score > 60 %}bg-yellow-500
                        {% else %}bg-red-600{% endif %}">
                            Metacritic: {{ entry.metacritic_score }}%
                        </span>
                        {% endif %}
                        {% if entry.igdb_user_score %}
                        <span class="rounded-full px-3 py-1 text-sm font-semibold m-1
                        {% if entry.igdb_user_score > 90 %}bg-green-700
                        {% elif entry.igdb_user_score > 80 %}bg-green-500
                        {% elif entry.igdb_user_score > 60 %}bg-yellow-500
                        {% else %}bg-red-600{% endif %}">
                            IGDB User: {{ entry.igdb_user_score }}% ({{ entry.igdb_user_ratings }} sources)
                        </span>
                        {% endif %}
                    </div>

                    <!-- Genres -->
                    <div class="flex flex-wrap mb-2">
                        {% if entry.genres %}
                        <div class="flex flex-wrap">
                            {% for genre in entry.genres.split(', ') %}
                            <span class="text-white bg-gray-500 rounded-full px-3 py-1 text-sm font-semibold m-1">#{{ genre }}</span>
                            {% endfor %}
                        </div>
                        {% else %}
                        <span class="text-white bg-gray-500 rounded-full px-3 py-1 text-sm font-semibold m-1">#Unknown</span>
                        {% endif %}
                    </div>

                    <!-- Other Info -->
                    <div>
                        {{ entry.description }}
                    </div>


                </div>

                <!-- Claim Button -->
                <div class="flex justify-between items-center mt-4">
                    <!-- Claim Button -->
                    {% if entry.url %}
                    <a href="{{ entry.url }}" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                        Claim on {{ entry.source }}
                    </a>
                    {% endif %}

                    <!-- Recommended Price -->
                    {% if entry.recommended_price %}
                    <span class="bg-gray-500 text-white font-bold py-2 px-4 rounded line-through">
                        {{ entry.recommended_price }} EUR
                    </span>
                    {% endif %}
                </div>

            </div>
        </div>
        {% endfor %}
    </div>
</body>
</html>
"""  # noqa: E501


def generate_html(
    offers: Sequence[Offer],
    file: Path,
    author_name: str,
    author_mail: str,
    author_web: str,
    feed_id_prefix: str,
    source: Source | None = None,
    type_: OfferType | None = None,
    duration: OfferDuration | None = None,
) -> None:
    """Generate a html view with the given offers."""
    if len(offers) == 0:
        return

    latest_date: datetime | None = None

    entries = []

    for offer in offers:
        # Skip entries without any dates, they are probably not valid
        if not offer.seen_first and not offer.seen_last:
            continue

        # Skip future entries and entries that are no longer seen before they
        # ever were valid
        if offer.valid_from and offer.valid_from > offer.seen_last:
            continue

        # Determine the date to use for updated. Preferred is valid_from,
        # but seen_first is used if valid_from is not known.
        if (
            offer.valid_from
            and offer.seen_first
            and offer.valid_from > offer.seen_first
        ):
            updated: datetime | None = offer.valid_from
        else:
            updated = offer.seen_first

        # Remember the newest entry date for the whole feed date
        if not latest_date or (updated and updated > latest_date):
            latest_date = updated

        # Save the needed info

        entry = {}
        entry["id"] = f"{feed_id_prefix}{int(offer.id)}"

        additional_info = offer.type.value
        if offer.duration != OfferDuration.CLAIMABLE:
            additional_info += f", {offer.duration.value}"

        entry["title"] = offer.title

        # - Content
        game: Game | None = offer.game

        if offer.img_url:
            entry["img_url"] = html.escape(offer.img_url)
        elif game and game.steam_info and game.steam_info.image_url:
            entry["img_url"] = html.escape(game.steam_info.image_url)

        valid_from = (
            offer.valid_from.strftime(TIMESTAMP_SHORT)
            if offer.valid_from
            else offer.seen_first.strftime(TIMESTAMP_SHORT)
        )
        entry["valid_from"] = valid_from
        if offer.valid_to:
            entry["valid_to"] = offer.valid_to.strftime(TIMESTAMP_SHORT)
        if offer.url:
            entry["source"] = html.escape(offer.source.value)
            entry["url"] = html.escape(offer.url)

        if offer.valid_to and offer.valid_to < datetime.now(tz=timezone.utc):
            entry["is_expired"] = True
        else:
            entry["is_expired"] = False

        if game:
            entry["has_game"] = True
            if game.igdb_info and game.igdb_info.name:
                entry["game_name"] = html.escape(game.igdb_info.name)
            elif game.steam_info and game.steam_info.name:
                entry["game_name"] = html.escape(game.steam_info.name)

            if game.steam_info and game.steam_info.metacritic_score:
                entry["metacritic_score"] = game.steam_info.metacritic_score
                if game.steam_info.metacritic_url:
                    entry["metacritic_url"] = html.escape(
                        game.steam_info.metacritic_url,
                    )
            if (
                game.steam_info
                and game.steam_info.percent
                and game.steam_info.score
                and game.steam_info.recommendations
            ):
                entry["steam_percent"] = game.steam_info.percent
                entry["steam_score"] = game.steam_info.score
                entry["steam_recommendations"] = game.steam_info.recommendations
                entry["steam_url"] = html.escape(game.steam_info.url)
            if (
                game.igdb_info
                and game.igdb_info.meta_ratings
                and game.igdb_info.meta_score
            ):
                entry["igdb_meta_score"] = game.igdb_info.meta_score
                entry["igdb_meta_ratings"] = game.igdb_info.meta_ratings
                entry["igdb_url"] = html.escape(game.igdb_info.url)
            if (
                game.igdb_info
                and game.igdb_info.user_ratings
                and game.igdb_info.user_score
            ):
                entry["igdb_user_score"] = game.igdb_info.user_score
                entry["igdb_user_ratings"] = game.igdb_info.user_ratings
            if game.igdb_info and game.igdb_info.release_date:
                entry["release_date"] = game.igdb_info.release_date.strftime(
                    TIMESTAMP_SHORT,
                )
            elif game.steam_info and game.steam_info.release_date:
                entry["release_date"] = game.steam_info.release_date.strftime(
                    TIMESTAMP_SHORT,
                )
            if game.steam_info and game.steam_info.recommended_price_eur:
                entry["recommended_price"] = game.steam_info.recommended_price_eur
            if game.igdb_info and game.igdb_info.short_description:
                entry["description"] = html.escape(
                    game.igdb_info.short_description,
                )
            elif game.steam_info and game.steam_info.short_description:
                entry["description"] = html.escape(
                    game.steam_info.short_description,
                )
            if game.steam_info and game.steam_info.genres:
                entry["genres"] = html.escape(game.steam_info.genres)

        # Add to array
        entries.append(entry)

    feed = {
        "author_name": author_name,
        "author_email": author_mail,
        "author_uri": author_web,
        "title": get_title(source, type_, duration),
        "updated": latest_date,
    }

    template = Template(TEMPLATE_STR)
    rendered_html = template.render(entries=entries, feed=feed)

    with file.open("w", encoding="utf-8") as f:
        f.write(rendered_html)


def get_title(
    source: Source | None,
    type_: OfferType | None,
    duration: OfferDuration | None,
) -> str:
    if source is None and type_ is None and duration is None:
        return "Free Games and Loot"

    title = "Free"

    if source is not None:
        title += " " + source.value

    if type_ == OfferType.GAME:
        title += " Games"
    elif type_ == OfferType.LOOT:
        title += " Loot"

    if duration in (OfferDuration.TEMPORARY, OfferDuration.ALWAYS):
        title += f" ({duration.value})"

    return title

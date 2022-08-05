"""Game table

Revision ID: 8b0536741936
Revises: 8267b60db582
Create Date: 2022-04-15 20:03:32.928325+00:00

"""
# pylint: disable=no-member

from __future__ import annotations

import json
import logging
from typing import Any

import sqlalchemy as sa
from sqlalchemy import orm
from sqlalchemy.ext.declarative import declarative_base

from alembic import op
from app.migration.gameinfo import Gameinfo

# revision identifiers, used by Alembic.
revision = "8b0536741936"
down_revision = "8267b60db582"
branch_labels = None
depends_on = None


Base = declarative_base()  # type: Any


class OldLoot(Base):
    __tablename__ = "loot"

    id = sa.Column(sa.Integer, primary_key=True, nullable=False)
    seen_first = sa.Column(sa.DateTime)
    seen_last = sa.Column(sa.DateTime)
    source = sa.Column(sa.String)
    type = sa.Column(sa.String)
    rawtext = sa.Column(sa.String)
    title = sa.Column(sa.String)
    subtitle = sa.Column(sa.String)
    publisher = sa.Column(sa.String)
    valid_from = sa.Column(sa.DateTime)
    valid_to = sa.Column(sa.DateTime)
    url = sa.Column(sa.String)
    img_url = sa.Column(sa.String)
    gameinfo = sa.Column(sa.String)


class Game(Base):
    __tablename__ = "games"

    id = sa.Column(sa.Integer, primary_key=True, nullable=False)

    # Steam scraped data
    steam_id = sa.Column(sa.Integer)
    steam_url = sa.Column(sa.String)
    steam_recommendations = sa.Column(sa.Integer)
    steam_percent = sa.Column(sa.Integer)
    steam_score = sa.Column(sa.Integer)
    metacritic_score = sa.Column(sa.Integer)
    metacritic_url = sa.Column(sa.String)
    recommended_price_eur = sa.Column(sa.Float)

    # IGDB scraped data
    igdb_id = sa.Column(sa.Integer)
    igdb_url = sa.Column(sa.String)
    igdb_user_score = sa.Column(sa.Integer)
    igdb_user_ratings = sa.Column(sa.Integer)
    igdb_meta_score = sa.Column(sa.Integer)
    igdb_meta_ratings = sa.Column(sa.Integer)

    # Could be from both
    name = sa.Column(sa.String)
    short_description = sa.Column(sa.String)
    genres = sa.Column(sa.String)  # Currently Steam only
    publishers = sa.Column(sa.String)  # Currently Steam only
    release_date = sa.Column(sa.DateTime)
    image_url = sa.Column(sa.String)  # Currently Steam only

    offers = orm.relationship("Offer", back_populates="game")


class Offer(Base):
    __tablename__ = "offers"

    id = sa.Column(sa.Integer, primary_key=True)
    source = sa.Column(sa.Enum("AMAZON", "EPIC", "STEAM", "GOG", name="source"))
    type = sa.Column(sa.Enum("LOOT", "GAME", name="offertype"))
    title = sa.Column(sa.String)

    seen_first = sa.Column(sa.DateTime)
    seen_last = sa.Column(sa.DateTime)
    valid_from = sa.Column(sa.DateTime)
    valid_to = sa.Column(sa.DateTime)

    rawtext = sa.Column(sa.String)
    url = sa.Column(sa.String)
    img_url = sa.Column(sa.String)

    game_id = sa.Column(sa.Integer, sa.ForeignKey("games.id"))
    game = orm.relationship("Game", back_populates="offers")


def upgrade() -> None:
    bind = op.get_bind()

    # Create the new tables
    Game.__table__.create(bind)
    Offer.__table__.create(bind)

    # Migrate the old data (and fix missing rawtext in the process)
    with orm.Session(bind=bind) as session:
        loot: OldLoot
        for loot in session.scalars(sa.select(OldLoot)).all():
            if loot.source == "Amazon Prime":
                source = "AMAZON"
                if loot.rawtext:
                    rawtext = loot.rawtext
                else:
                    rawtext = f"<title>{loot.title}"
                    if loot.subtitle:
                        rawtext += f": {loot.subtitle}"
                    rawtext += "</title>"
                    if loot.publisher:
                        rawtext += f"<paragraph>{loot.publisher}</paragraph>"
            elif loot.source == "Epic Games":
                source = "EPIC"
                if loot.rawtext:
                    rawtext = loot.rawtext
                else:
                    rawtext = f"<title>{loot.title}</title>"
            elif loot.source == "Steam":
                source = "STEAM"
                if loot.rawtext:
                    rawtext = loot.rawtext
                else:
                    rawtext = f"<title>{loot.title}</title>"
                    if loot.gameinfo is not None:
                        try:
                            gameinfo = json.loads(loot.gameinfo)
                            if gameinfo["steam_id"]:
                                rawtext += f'<appid>{gameinfo["steam_id"]}</appid>'
                        except KeyError:
                            pass
            elif loot.source == "GOG":
                source = "GOG"
                if loot.rawtext:
                    rawtext = loot.rawtext
                else:
                    rawtext = f"<title>{loot.title}</title>"

            if loot.type == "Loot":
                type_ = "LOOT"
            elif loot.type == "Game":
                type_ = "GAME"

            title = loot.title
            if loot.subtitle:
                title += f": {loot.subtitle}"

            new_offer = Offer(
                id=loot.id,
                source=source,
                type=type_,
                title=title,
                seen_first=loot.seen_first,
                seen_last=loot.seen_last,
                valid_from=loot.valid_from,
                valid_to=loot.valid_to,
                rawtext=rawtext,
                url=loot.url,
                img_url=loot.img_url,
            )

            if loot.gameinfo:
                gameinfo = Gameinfo.from_json(loot.gameinfo)

                existing_game = None
                if gameinfo.steam_id:
                    existing_game = (
                        session.execute(
                            sa.select(Game).where(Game.steam_id == gameinfo.steam_id)
                        )
                        .scalars()
                        .first()
                    )
                if existing_game is None and gameinfo.idgb_id:
                    existing_game = (
                        session.execute(
                            sa.select(Game).where(Game.igdb_id == gameinfo.idgb_id)
                        )
                        .scalars()
                        .first()
                    )

                # Use existing game if it exists, otherwise create new game
                if existing_game is not None:
                    new_offer.game = existing_game
                else:
                    try:
                        genres = ", ".join(gameinfo.genres)
                    except TypeError:
                        genres = gameinfo.genres
                    logging.info(genres)
                    game = Game(
                        steam_id=gameinfo.steam_id,
                        igdb_id=gameinfo.idgb_id,
                        name=gameinfo.name,
                        short_description=gameinfo.short_description,
                        release_date=gameinfo.release_date,
                        recommended_price_eur=gameinfo.recommended_price_eur,
                        genres=genres,
                        publishers=loot.publisher,
                        steam_recommendations=gameinfo.steam_recommendations,
                        steam_percent=gameinfo.steam_percent,
                        steam_score=gameinfo.steam_score,
                        igdb_user_score=gameinfo.igdb_user_score,
                        igdb_user_ratings=gameinfo.igdb_user_ratings,
                        igdb_meta_score=gameinfo.igdb_meta_score,
                        igdb_meta_ratings=gameinfo.igdb_meta_ratings,
                        igdb_url=gameinfo.igdb_url,
                        metacritic_score=gameinfo.metacritic_score,
                        metacritic_url=gameinfo.metacritic_url,
                        steam_url=gameinfo.steam_url,
                        image_url=gameinfo.image_url,
                    )
                    session.add(game)
                    new_offer.game = game

            session.add(new_offer)
        session.commit()

    op.drop_table("loot")


def downgrade() -> None:
    bind = op.get_bind()

    # Create the old tables
    OldLoot.__table__.create(bind)

    # Loop over all Offer objects and create OldLoot objects
    with orm.Session(bind=bind) as session:
        offer: Offer
        for offer in session.scalars(sa.select(Offer)).all():

            if offer.source == "AMAZON":
                source = "Amazon Prime"
            elif offer.source == "EPIC":
                source = "Epic Games"
            elif offer.source == "STEAM":
                source = "Steam"
            elif offer.source == "GOG":
                source = "GOG"

            if offer.type == "LOOT":
                type_ = "Loot"
            elif offer.type == "GAME":
                type_ = "Game"

            if offer.source == "AMAZON":
                parsed_heads = offer.title.split(": ", 1)
                title = parsed_heads[0]
                subtitle = parsed_heads[1] if len(parsed_heads) == 2 else None
                if offer.game and offer.game.publishers:
                    publisher = offer.game.publishers
            else:
                title = offer.title
                subtitle = None
                publisher = None

            game: Game = offer.game
            if offer.game:
                gameinfo = Gameinfo(
                    steam_id=game.steam_id,
                    idgb_id=game.igdb_id,
                    name=game.name,
                    short_description=game.short_description,
                    release_date=game.release_date,
                    recommended_price_eur=game.recommended_price_eur,
                    genres=game.genres.split(", ") if game.genres else None,
                    publishers=game.publishers,
                    steam_recommendations=game.steam_recommendations,
                    steam_percent=game.steam_percent,
                    steam_score=game.steam_score,
                    igdb_user_score=game.igdb_user_score,
                    igdb_user_ratings=game.igdb_user_ratings,
                    igdb_meta_score=game.igdb_meta_score,
                    igdb_meta_ratings=game.igdb_meta_ratings,
                    igdb_url=game.igdb_url,
                    metacritic_score=game.metacritic_score,
                    metacritic_url=game.metacritic_url,
                    steam_url=game.steam_url,
                    image_url=game.image_url,
                ).to_json()
            else:
                gameinfo = None

            new_loot = OldLoot(
                id=offer.id,
                source=source,
                type=type_,
                title=title,
                subtitle=subtitle,
                publisher=publisher,
                seen_first=offer.seen_first,
                seen_last=offer.seen_last,
                valid_from=offer.valid_from,
                valid_to=offer.valid_to,
                rawtext=offer.rawtext,
                url=offer.url,
                img_url=offer.img_url,
                gameinfo=gameinfo,
            )

            session.add(new_loot)
        session.commit()

    op.drop_table("offers")
    op.drop_table("games")

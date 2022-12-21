"""Game table

Revision ID: 8b0536741936
Create Date: 2022-04-15 20:03:32.928325+00:00

"""
# pylint: disable=no-member

from __future__ import annotations

from typing import Any

import sqlalchemy as sa
from alembic import op
from sqlalchemy import orm
from sqlalchemy.ext.declarative import declarative_base

# revision identifiers, used by Alembic.
revision = "8b0536741936"
down_revision = None
branch_labels = None
depends_on = None


Base: Any = declarative_base()


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


def downgrade() -> None:
    op.drop_table("offers")
    op.drop_table("games")

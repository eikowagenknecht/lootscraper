"""Game table

Revision ID: 8b0536741936
Create Date: 2022-04-15 20:03:32.928325+00:00

"""
# pylint: disable=no-member

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy import orm

# revision identifiers, used by Alembic.
revision = "8b0536741936"
down_revision = None
branch_labels = None
depends_on = None


class Base(orm.DeclarativeBase):
    __allow_unmapped__ = True


class Game(Base):
    __tablename__ = "games"

    id = orm.mapped_column(sa.Integer, primary_key=True, nullable=False)

    # Steam scraped data
    steam_id = orm.mapped_column(sa.Integer)
    steam_url = orm.mapped_column(sa.String)
    steam_recommendations = orm.mapped_column(sa.Integer)
    steam_percent = orm.mapped_column(sa.Integer)
    steam_score = orm.mapped_column(sa.Integer)
    metacritic_score = orm.mapped_column(sa.Integer)
    metacritic_url = orm.mapped_column(sa.String)
    recommended_price_eur = orm.mapped_column(sa.Float)

    # IGDB scraped data
    igdb_id = orm.mapped_column(sa.Integer)
    igdb_url = orm.mapped_column(sa.String)
    igdb_user_score = orm.mapped_column(sa.Integer)
    igdb_user_ratings = orm.mapped_column(sa.Integer)
    igdb_meta_score = orm.mapped_column(sa.Integer)
    igdb_meta_ratings = orm.mapped_column(sa.Integer)

    # Could be from both
    name = orm.mapped_column(sa.String)
    short_description = orm.mapped_column(sa.String)
    genres = orm.mapped_column(sa.String)  # Currently Steam only
    publishers = orm.mapped_column(sa.String)  # Currently Steam only
    release_date = orm.mapped_column(sa.DateTime)
    image_url = orm.mapped_column(sa.String)  # Currently Steam only

    offers = orm.relationship("Offer", back_populates="game")


class Offer(Base):
    __tablename__ = "offers"

    id = orm.mapped_column(sa.Integer, primary_key=True)
    source = orm.mapped_column(sa.Enum("AMAZON", "EPIC", "STEAM", "GOG", name="source"))
    type = orm.mapped_column(sa.Enum("LOOT", "GAME", name="offertype"))
    title = orm.mapped_column(sa.String)

    seen_first = orm.mapped_column(sa.DateTime)
    seen_last = orm.mapped_column(sa.DateTime)
    valid_from = orm.mapped_column(sa.DateTime)
    valid_to = orm.mapped_column(sa.DateTime)

    rawtext = orm.mapped_column(sa.String)
    url = orm.mapped_column(sa.String)
    img_url = orm.mapped_column(sa.String)

    game_id = orm.mapped_column(sa.Integer, sa.ForeignKey("games.id"))
    game = orm.relationship("Game", back_populates="offers")


def upgrade() -> None:
    bind = op.get_bind()

    # Create the new tables
    Game.__table__.create(bind)
    Offer.__table__.create(bind)


def downgrade() -> None:
    op.drop_table("offers")
    op.drop_table("games")

"""Split game information. Warning: Needs refresh of offers once after.

Revision ID: 038c26b62555
Revises: c5a42a07d104
Create Date: 2022-04-19 12:47:03.252360+00:00

"""
# pylint: disable=no-member

from typing import Any

import sqlalchemy as sa
from alembic import op
from sqlalchemy import orm

from lootscraper.database import AwareDateTime

# revision identifiers, used by Alembic.
revision = "038c26b62555"
down_revision = "c5a42a07d104"
branch_labels = None
depends_on = None


class Base(orm.DeclarativeBase):
    __allow_unmapped__ = True
    pass


class Game(Base):
    __tablename__ = "games"

    id = sa.Column(sa.Integer, primary_key=True, nullable=False)

    steam_id = sa.Column(sa.Integer)
    igdb_id = sa.Column(sa.Integer)

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

    with orm.Session(bind=bind) as session:
        offer: Offer
        for offer in session.scalars(sa.select(Offer)).all():
            offer.game_id = None
        session.commit()

    op.create_table(
        "igdb_info",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("url", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("short_description", sa.String(), nullable=True),
        sa.Column("release_date", AwareDateTime(), nullable=True),
        sa.Column("user_score", sa.Integer(), nullable=True),
        sa.Column("user_ratings", sa.Integer(), nullable=True),
        sa.Column("meta_score", sa.Integer(), nullable=True),
        sa.Column("meta_ratings", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "steam_info",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("url", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("short_description", sa.String(), nullable=True),
        sa.Column("release_date", AwareDateTime(), nullable=True),
        sa.Column("genres", sa.String(), nullable=True),
        sa.Column("publishers", sa.String(), nullable=True),
        sa.Column("image_url", sa.String(), nullable=True),
        sa.Column("recommendations", sa.Integer(), nullable=True),
        sa.Column("percent", sa.Integer(), nullable=True),
        sa.Column("score", sa.Integer(), nullable=True),
        sa.Column("metacritic_score", sa.Integer(), nullable=True),
        sa.Column("metacritic_url", sa.String(), nullable=True),
        sa.Column("recommended_price_eur", sa.Float(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.drop_table("games")
    op.create_table(
        "games",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "igdb_id", sa.Integer(), sa.ForeignKey("igdb_info.id"), nullable=True
        ),
        sa.Column(
            "steam_id", sa.Integer(), sa.ForeignKey("steam_info.id"), nullable=True
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    bind = op.get_bind()

    with orm.Session(bind=bind) as session:
        offer: Offer
        for offer in session.scalars(sa.select(Offer)).all():
            offer.game_id = None
        session.commit()

    op.drop_table("steam_info")
    op.drop_table("igdb_info")
    op.drop_table("games")

    op.create_table(
        "games",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("igdb_id", sa.String(), nullable=True),
        sa.Column("igdb_url", sa.String(), nullable=True),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("short_description", sa.String(), nullable=True),
        sa.Column("release_date", AwareDateTime(), nullable=True),
        sa.Column("igdb_user_score", sa.Integer(), nullable=True),
        sa.Column("igdb_user_ratings", sa.Integer(), nullable=True),
        sa.Column("igdb_meta_score", sa.Integer(), nullable=True),
        sa.Column("igdb_meta_ratings", sa.Integer(), nullable=True),
        sa.Column("steam_url", sa.String(), nullable=True),
        sa.Column("genres", sa.String(), nullable=True),
        sa.Column("publishers", sa.String(), nullable=True),
        sa.Column("image_url", sa.String(), nullable=True),
        sa.Column("steam_recommendations", sa.Integer(), nullable=True),
        sa.Column("steam_percent", sa.Integer(), nullable=True),
        sa.Column("steam_score", sa.Integer(), nullable=True),
        sa.Column("metacritic_score", sa.Integer(), nullable=True),
        sa.Column("metacritic_url", sa.String(), nullable=True),
        sa.Column("recommended_price_eur", sa.Float(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

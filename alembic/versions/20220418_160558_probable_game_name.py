"""Probable game name

Revision ID: c5a42a07d104
Revises: 8b0536741936
Create Date: 2022-04-18 16:05:58.909502+00:00

"""
# pylint: disable=no-member

import re
from typing import Any

import sqlalchemy as sa
from sqlalchemy import orm
from sqlalchemy.ext.declarative import declarative_base

from alembic import op
from app.common import OfferType, Source

# revision identifiers, used by Alembic.
revision = "c5a42a07d104"
down_revision = "8b0536741936"
branch_labels = None
depends_on = None


Base = declarative_base()  # type: Any


class Game(Base):
    __tablename__ = "games"

    id = sa.Column(sa.Integer, primary_key=True, nullable=False)

    steam_id = sa.Column(sa.Integer)
    igdb_id = sa.Column(sa.Integer)

    offers = orm.relationship("Offer", back_populates="game")


class Offer(Base):
    __tablename__ = "offers"

    id: int = sa.Column(sa.Integer, primary_key=True)
    source = sa.Column(sa.Enum("AMAZON", "EPIC", "STEAM", "GOG", name="source"))
    type = sa.Column(sa.Enum("LOOT", "GAME", name="offertype"))
    title: str = sa.Column(sa.String)
    probable_game_name: str = sa.Column(sa.String)

    seen_first = sa.Column(sa.DateTime)
    seen_last = sa.Column(sa.DateTime)
    valid_from = sa.Column(sa.DateTime)
    valid_to = sa.Column(sa.DateTime)

    rawtext: str | None = sa.Column(sa.String)
    url: str | None = sa.Column(sa.String)
    img_url: str | None = sa.Column(sa.String)

    game_id = sa.Column(sa.Integer, sa.ForeignKey("games.id"))
    game = orm.relationship("Game", back_populates="offers")


def upgrade() -> None:

    with op.batch_alter_table("offers", schema=None) as batch_op:
        batch_op.add_column(  # type: ignore
            sa.Column("probable_game_name", sa.String(), nullable=True)
        )
        batch_op.alter_column(  # type: ignore
            "source", existing_type=sa.VARCHAR(length=6), nullable=False
        )
        batch_op.alter_column(  # type: ignore
            "type", existing_type=sa.VARCHAR(length=4), nullable=False
        )
        batch_op.alter_column(  # type: ignore
            "title", existing_type=sa.VARCHAR(), nullable=False
        )

    bind = op.get_bind()
    with orm.Session(bind=bind) as session:
        offer: Offer
        for offer in session.scalars(sa.select(Offer)).all():
            probable_game_name: str | None = None
            if offer.type == OfferType.LOOT and offer.source == Source.AMAZON:
                title_parts: list[str] = offer.title.split(": ")
                if len(title_parts) >= 3:
                    probable_game_name = ": ".join(title_parts[:-1])
                if probable_game_name is None:
                    match = re.compile(r"Get .* in (.*)").match(offer.title)
                    if match and match.group(1):
                        probable_game_name = match.group(1)
                if probable_game_name is None and len(title_parts) == 2:
                    probable_game_name = ": ".join(title_parts[:-1])
                if probable_game_name is None:
                    probable_game_name = offer.title
                offer.probable_game_name = probable_game_name
            else:
                offer.probable_game_name = (
                    offer.title.removesuffix(" on Origin")
                    .removesuffix(" Game of the Year Edition Deluxe")
                    .removesuffix(" Game of the Year Edition")
                )

        session.commit()

    with op.batch_alter_table("offers", schema=None) as batch_op:
        batch_op.alter_column(  # type: ignore
            "probable_game_name", existing_type=sa.String, nullable=False
        )


def downgrade() -> None:
    with op.batch_alter_table("offers", schema=None) as batch_op:
        batch_op.alter_column(  # type: ignore
            "title", existing_type=sa.VARCHAR(), nullable=True
        )
        batch_op.alter_column(  # type: ignore
            "type", existing_type=sa.VARCHAR(length=4), nullable=True
        )
        batch_op.alter_column(  # type: ignore
            "source", existing_type=sa.VARCHAR(length=6), nullable=True
        )
        batch_op.drop_column("probable_game_name")  # type: ignore

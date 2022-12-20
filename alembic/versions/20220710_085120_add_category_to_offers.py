"""Add category to offers

Revision ID: ebc6ef467953
Revises: 254444f3560f
Create Date: 2022-07-10 08:51:20.622359+00:00

"""
# pylint: disable=no-member

from datetime import datetime
from typing import Any

import sqlalchemy as sa
from sqlalchemy import orm
from sqlalchemy.ext.declarative import declarative_base

from alembic import op
from app.common import Category, OfferDuration, OfferType, Source
from app.database import AwareDateTime

# revision identifiers, used by Alembic.
revision = "ebc6ef467953"
down_revision = "254444f3560f"
branch_labels = None
depends_on = None


Base: Any = declarative_base()


class Game(Base):
    __tablename__ = "games"

    id = sa.Column(sa.Integer, primary_key=True, nullable=False)

    steam_id = sa.Column(sa.Integer)
    igdb_id = sa.Column(sa.Integer)

    offers = orm.relationship("Offer", back_populates="game")


class Offer(Base):
    """An offer, can be for a game or some other game related content (loot)."""

    __tablename__ = "offers"

    id: int = sa.Column(sa.Integer, primary_key=True, nullable=False)
    source: Source = sa.Column(sa.Enum(Source), nullable=False)
    type: OfferType = sa.Column(sa.Enum(OfferType), nullable=False)
    duration: OfferDuration = sa.Column(sa.Enum(OfferDuration), nullable=False)
    category: Category = sa.Column(
        sa.Enum(Category), nullable=False, default=Category.VALID
    )

    title: str = sa.Column(sa.String, nullable=False)
    probable_game_name: str = sa.Column(sa.String, nullable=False)

    seen_first: datetime = sa.Column(AwareDateTime, nullable=False)
    seen_last: datetime = sa.Column(AwareDateTime, nullable=False)
    valid_from: datetime | None = sa.Column(AwareDateTime)
    valid_to: datetime | None = sa.Column(AwareDateTime)

    rawtext: str | None = sa.Column(sa.String)
    url: str | None = sa.Column(sa.String)
    img_url: str | None = sa.Column(sa.String)

    game_id: int | None = sa.Column(sa.Integer, sa.ForeignKey("games.id"))
    game: Game | None = orm.relationship("Game", back_populates="offers")


def upgrade() -> None:
    # 1 - Add new column as nullable
    with op.batch_alter_table("offers", schema=None) as batch_op:
        batch_op.add_column(  # type: ignore
            sa.Column(
                "category",
                sa.Enum(
                    "VALID",
                    "DEMO",
                    "CHEAP",
                    name="category",
                ),
                nullable=True,
            )
        )

    # 2 - Fill it
    bind = op.get_bind()
    with orm.Session(bind=bind) as session:
        offer: Offer
        for offer in session.scalars(sa.select(Offer)).all():
            offer.category = Category.VALID

        session.commit()

    # 3 - Make it non-nullable
    with op.batch_alter_table("offers", schema=None) as batch_op:
        batch_op.alter_column("category", nullable=False)  # type: ignore


def downgrade() -> None:
    with op.batch_alter_table("offers", schema=None) as batch_op:
        batch_op.drop_column("category")  # type: ignore

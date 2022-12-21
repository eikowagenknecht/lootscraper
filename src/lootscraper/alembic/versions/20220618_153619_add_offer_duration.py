"""Add offer duration

Revision ID: 254444f3560f
Revises: fc43de437432
Create Date: 2022-06-18 15:36:19.169481+00:00

"""
# pylint: disable=no-member

from datetime import datetime
from typing import Any

import sqlalchemy as sa
from alembic import op
from sqlalchemy import orm
from sqlalchemy.ext.declarative import declarative_base

from lootscraper.common import OfferDuration, OfferType, Source
from lootscraper.database import AwareDateTime, TelegramSubscription

# revision identifiers, used by Alembic.
revision = "254444f3560f"
down_revision = "fc43de437432"
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
                "duration",
                sa.Enum(
                    "ALWAYS",
                    "CLAIMABLE",
                    "TEMPORARY",
                    name="offerduration",
                ),
                nullable=True,
            )
        )

    with op.batch_alter_table("telegram_subscriptions", schema=None) as batch_op:
        batch_op.add_column(  # type: ignore
            sa.Column(
                "duration",
                sa.Enum(
                    "ALWAYS",
                    "CLAIMABLE",
                    "TEMPORARY",
                    name="offerduration",
                ),
                nullable=True,
            )
        )

    # 2 - Fill it
    bind = op.get_bind()
    with orm.Session(bind=bind) as session:
        offer: Offer
        for offer in session.scalars(sa.select(Offer)).all():
            offer.duration = OfferDuration.CLAIMABLE

        sub: TelegramSubscription
        for sub in session.scalars(sa.select(TelegramSubscription)).all():
            sub.duration = OfferDuration.CLAIMABLE

        session.commit()

    # 3 - Make it non-nullable
    with op.batch_alter_table("offers", schema=None) as batch_op:
        batch_op.alter_column("duration", nullable=False)  # type: ignore

    with op.batch_alter_table("telegram_subscriptions", schema=None) as batch_op:
        batch_op.alter_column("duration", nullable=False)  # type: ignore


def downgrade() -> None:
    with op.batch_alter_table("offers", schema=None) as batch_op:
        batch_op.drop_column("duration")  # type: ignore

    with op.batch_alter_table("telegram_subscriptions", schema=None) as batch_op:
        batch_op.drop_column("duration")  # type: ignore

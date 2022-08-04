"""Add offer duration

Revision ID: 254444f3560f
Revises: fc43de437432
Create Date: 2022-06-18 15:36:19.169481+00:00

"""
from datetime import datetime
from typing import Any

import sqlalchemy as sa
import sqlalchemy.orm as orm
from sqlalchemy import Column, Enum, ForeignKey, Integer, String, select
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

from alembic import op
from app.common import OfferDuration, OfferType, Source
from app.sqlalchemy import AwareDateTime, TelegramSubscription

# revision identifiers, used by Alembic.
revision = "254444f3560f"
down_revision = "fc43de437432"
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
    """An offer, can be for a game or some other game related content (loot)."""

    __tablename__ = "offers"

    id: int = Column(Integer, primary_key=True, nullable=False)
    source: Source = Column(Enum(Source), nullable=False)
    type: OfferType = Column(Enum(OfferType), nullable=False)
    duration: OfferDuration = Column(Enum(OfferDuration), nullable=False)
    title: str = Column(String, nullable=False)
    probable_game_name: str = Column(String, nullable=False)

    seen_first: datetime = Column(AwareDateTime, nullable=False)
    seen_last: datetime = Column(AwareDateTime, nullable=False)
    valid_from: datetime | None = Column(AwareDateTime)
    valid_to: datetime | None = Column(AwareDateTime)

    rawtext: str | None = Column(String)
    url: str | None = Column(String)
    img_url: str | None = Column(String)

    game_id: int | None = Column(Integer, ForeignKey("games.id"))
    game: Game | None = relationship("Game", back_populates="offers")


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
        for offer in session.scalars(select(Offer)).all():
            offer.duration = OfferDuration.CLAIMABLE

        sub: TelegramSubscription
        for sub in session.scalars(select(TelegramSubscription)).all():
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

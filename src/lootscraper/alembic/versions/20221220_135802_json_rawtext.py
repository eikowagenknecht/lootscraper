"""JSON rawtext

Revision ID: 134d2f5d6d80
Revises: d2c85b75ece0
Create Date: 2022-12-20 13:58:02.312815+00:00

"""
# pylint: disable=no-member
import json
import re
from datetime import datetime
from typing import Any

import sqlalchemy as sa
from alembic import op
from sqlalchemy import orm

from lootscraper.common import Category, OfferDuration, OfferType, Source
from lootscraper.database import AwareDateTime

# revision identifiers, used by Alembic.
revision = "134d2f5d6d80"
down_revision = "d2c85b75ece0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1 - Convert data
    bind = op.get_bind()
    with orm.Session(bind=bind) as session:
        offer: Offer
        for offer in session.query(Offer):
            # Replace empty values with correct NULLs
            if offer.rawtext is not None and offer.rawtext.startswith("<"):
                new_json: dict[str, str] = {}
                add_xml_element_if_exists(new_json, offer.rawtext, "title")
                add_xml_element_if_exists(new_json, offer.rawtext, "paragraph")
                add_xml_element_if_exists(new_json, offer.rawtext, "startdate")
                add_xml_element_if_exists(new_json, offer.rawtext, "enddate")
                add_xml_element_if_exists(new_json, offer.rawtext, "appid")
                add_xml_element_if_exists(new_json, offer.rawtext, "gametitle")
                add_xml_element_if_exists(new_json, offer.rawtext, "text")
                offer.rawtext = json.dumps(new_json)

        session.commit()

    with op.batch_alter_table("offers", schema=None) as batch_op:
        batch_op.alter_column(  # type: ignore
            "rawtext",
            existing_type=sa.VARCHAR(),
            type_=sa.JSON(),
            existing_nullable=True,
        )


def downgrade() -> None:
    with op.batch_alter_table("offers", schema=None) as batch_op:
        batch_op.alter_column(  # type: ignore
            "rawtext",
            existing_type=sa.JSON(),
            type_=sa.VARCHAR(),
            existing_nullable=True,
        )


def add_xml_element_if_exists(
    target: dict[str, str], source: str, element: str
) -> None:
    try:
        res = re.search(rf"<{element}>(.*)</{element}>", source)
        if res is not None:
            target[element] = res.group(1)
    except TypeError:
        pass


Base: Any = orm.declarative_base()


class Offer(Base):
    __allow_unmapped__ = True
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

    category: Category = sa.Column(
        sa.Enum(Category), nullable=False, default=Category.VALID
    )

    game_id: int | None = sa.Column(sa.Integer, sa.ForeignKey("games.id"))
    # game = orm.relationship("Game", back_populates="offers")


class Game(Base):
    __allow_unmapped__ = True
    __tablename__ = "games"

    id = sa.Column(sa.Integer, primary_key=True, nullable=False)

    steam_id = sa.Column(sa.Integer)
    igdb_id = sa.Column(sa.Integer)

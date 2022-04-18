"""Probable game name

Revision ID: c5a42a07d104
Revises: 8b0536741936
Create Date: 2022-04-18 16:05:58.909502+00:00

"""
import re

import sqlalchemy as sa
from sqlalchemy import orm

from alembic import op
from app.common import OfferType, Source
from app.sqlalchemy import Offer

# revision identifiers, used by Alembic.
revision = "c5a42a07d104"
down_revision = "8b0536741936"
branch_labels = None
depends_on = None


def upgrade() -> None:

    with op.batch_alter_table("offers", schema=None) as batch_op:  # type: ignore
        batch_op.add_column(sa.Column("probable_game_name", sa.String(), nullable=True))
        batch_op.alter_column(
            "source", existing_type=sa.VARCHAR(length=6), nullable=False
        )
        batch_op.alter_column(
            "type", existing_type=sa.VARCHAR(length=4), nullable=False
        )
        batch_op.alter_column("title", existing_type=sa.VARCHAR(), nullable=False)

    bind = op.get_bind()
    with orm.Session(bind=bind) as session:
        offer: Offer
        for offer in session.query(Offer):
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

    with op.batch_alter_table("offers", schema=None) as batch_op:  # type: ignore
        batch_op.alter_column(
            "probable_game_name", existing_type=sa.String, nullable=False
        )


def downgrade() -> None:
    with op.batch_alter_table("offers", schema=None) as batch_op:  # type: ignore
        batch_op.alter_column("title", existing_type=sa.VARCHAR(), nullable=True)
        batch_op.alter_column("type", existing_type=sa.VARCHAR(length=4), nullable=True)
        batch_op.alter_column(
            "source", existing_type=sa.VARCHAR(length=6), nullable=True
        )
        batch_op.drop_column("probable_game_name")

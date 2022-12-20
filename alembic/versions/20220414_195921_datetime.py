"""Datetime

Revision ID: 8267b60db582
Revises: d0cab9037616
Create Date: 2022-04-14 19:59:21.276815+00:00

"""
# pylint: disable=no-member

from datetime import datetime, timezone
from typing import Any

import sqlalchemy as sa
from sqlalchemy import orm
from sqlalchemy.ext.declarative import declarative_base

from alembic import op

# revision identifiers, used by Alembic.
revision = "8267b60db582"
down_revision = "d0cab9037616"
branch_labels = None
depends_on = None


def upgrade() -> None:
    Base: Any = declarative_base()

    class OldLoot(Base):
        __tablename__ = "loot"

        id = sa.Column(sa.Integer, primary_key=True)
        seen_first = sa.Column(sa.String(), nullable=True)
        seen_last = sa.Column(sa.String(), nullable=True)
        valid_from = sa.Column(sa.String(), nullable=True)
        valid_to = sa.Column(sa.String(), nullable=True)

        seen_first_tmp = sa.Column(sa.DateTime(), nullable=True)
        seen_last_tmp = sa.Column(sa.DateTime(), nullable=True)
        valid_from_tmp = sa.Column(sa.DateTime(), nullable=True)
        valid_to_tmp = sa.Column(sa.DateTime(), nullable=True)

    bind = op.get_bind()

    op.add_column("loot", sa.Column("seen_first_tmp", sa.DateTime(), nullable=True))
    op.add_column("loot", sa.Column("seen_last_tmp", sa.DateTime(), nullable=True))
    op.add_column("loot", sa.Column("valid_from_tmp", sa.DateTime(), nullable=True))
    op.add_column("loot", sa.Column("valid_to_tmp", sa.DateTime(), nullable=True))

    with orm.Session(bind=bind) as session:
        for loot in session.scalars(sa.select(OldLoot)).all():
            if loot.seen_first:
                loot.seen_first_tmp = datetime.fromisoformat(loot.seen_first).replace(
                    tzinfo=timezone.utc
                )
            if loot.seen_last:
                loot.seen_last_tmp = datetime.fromisoformat(loot.seen_last).replace(
                    tzinfo=timezone.utc
                )
            if loot.valid_from:
                loot.valid_from_tmp = datetime.fromisoformat(loot.valid_from).replace(
                    tzinfo=timezone.utc
                )
            if loot.valid_to:
                loot.valid_to_tmp = datetime.fromisoformat(loot.valid_to).replace(
                    tzinfo=timezone.utc
                )
        session.commit()

    with op.batch_alter_table("loot", schema=None) as batch_op:
        batch_op.drop_column("seen_first")  # type: ignore
        batch_op.drop_column("seen_last")  # type: ignore
        batch_op.drop_column("valid_from")  # type: ignore
        batch_op.drop_column("valid_to")  # type: ignore

        batch_op.alter_column("seen_first_tmp", new_column_name="seen_first")  # type: ignore
        batch_op.alter_column("seen_last_tmp", new_column_name="seen_last")  # type: ignore
        batch_op.alter_column("valid_from_tmp", new_column_name="valid_from")  # type: ignore
        batch_op.alter_column("valid_to_tmp", new_column_name="valid_to")  # type: ignore


def downgrade() -> None:
    Base = declarative_base()  # type: Any

    class NewLoot(Base):
        __tablename__ = "loot"

        id = sa.Column(sa.Integer, primary_key=True)
        seen_first = sa.Column(sa.DateTime(), nullable=True)
        seen_last = sa.Column(sa.DateTime(), nullable=True)
        valid_from = sa.Column(sa.DateTime(), nullable=True)
        valid_to = sa.Column(sa.DateTime(), nullable=True)

        seen_first_tmp = sa.Column(sa.String(), nullable=True)
        seen_last_tmp = sa.Column(sa.String(), nullable=True)
        valid_from_tmp = sa.Column(sa.String(), nullable=True)
        valid_to_tmp = sa.Column(sa.String(), nullable=True)

    bind = op.get_bind()

    op.add_column("loot", sa.Column("seen_first_tmp", sa.String(), nullable=True))
    op.add_column("loot", sa.Column("seen_last_tmp", sa.String(), nullable=True))
    op.add_column("loot", sa.Column("valid_from_tmp", sa.String(), nullable=True))
    op.add_column("loot", sa.Column("valid_to_tmp", sa.String(), nullable=True))

    with orm.Session(bind=bind) as session:
        for loot in session.scalars(sa.select(NewLoot)).all():
            if loot.seen_first:
                loot.seen_first_tmp = loot.seen_first.replace(
                    tzinfo=timezone.utc
                ).isoformat()
            if loot.seen_last:
                loot.seen_last_tmp = loot.seen_last.replace(
                    tzinfo=timezone.utc
                ).isoformat()
            if loot.valid_from:
                loot.valid_from_tmp = loot.valid_from.replace(
                    tzinfo=timezone.utc
                ).isoformat()
            if loot.valid_to:
                loot.valid_to_tmp = loot.valid_to.replace(
                    tzinfo=timezone.utc
                ).isoformat()
        session.commit()

    with op.batch_alter_table("loot", schema=None) as batch_op:
        batch_op.drop_column("loot", "seen_first")  # type: ignore
        batch_op.drop_column("loot", "seen_last")  # type: ignore
        batch_op.drop_column("loot", "valid_from")  # type: ignore
        batch_op.drop_column("loot", "valid_to")  # type: ignore

        batch_op.alter_column("seen_first_tmp", new_column_name="seen_first")  # type: ignore
        batch_op.alter_column("seen_last_tmp", new_column_name="seen_last")  # type: ignore
        batch_op.alter_column("valid_from_tmp", new_column_name="valid_from")  # type: ignore
        batch_op.alter_column("valid_to_tmp", new_column_name="valid_to")  # type: ignore

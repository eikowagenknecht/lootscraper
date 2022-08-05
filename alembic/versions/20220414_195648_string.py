"""String columns

Revision ID: d0cab9037616
Revises: f2ce7aba3802
Create Date: 2022-04-14 19:56:48.664279+00:00

"""
# pylint: disable=no-member

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "d0cab9037616"
down_revision = "f2ce7aba3802"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("loot", schema=None) as batch_op:
        batch_op.alter_column(  # type: ignore
            "seen_first",
            existing_type=sa.TEXT(),
            type_=sa.String(),
            existing_nullable=True,
        )
        batch_op.alter_column(  # type: ignore
            "seen_last",
            existing_type=sa.TEXT(),
            type_=sa.String(),
            existing_nullable=True,
        )
        batch_op.alter_column(  # type: ignore
            "source",
            existing_type=sa.TEXT(),
            type_=sa.String(),
            existing_nullable=True,
        )
        batch_op.alter_column(  # type: ignore
            "type",
            existing_type=sa.TEXT(),
            type_=sa.String(),
            existing_nullable=True,
        )
        batch_op.alter_column(  # type: ignore
            "rawtext",
            existing_type=sa.TEXT(),
            type_=sa.String(),
            existing_nullable=True,
        )
        batch_op.alter_column(  # type: ignore
            "title",
            existing_type=sa.TEXT(),
            type_=sa.String(),
            existing_nullable=True,
        )
        batch_op.alter_column(  # type: ignore
            "subtitle",
            existing_type=sa.TEXT(),
            type_=sa.String(),
            existing_nullable=True,
        )
        batch_op.alter_column(  # type: ignore
            "publisher",
            existing_type=sa.TEXT(),
            type_=sa.String(),
            existing_nullable=True,
        )
        batch_op.alter_column(  # type: ignore
            "valid_from",
            existing_type=sa.TEXT(),
            type_=sa.String(),
            existing_nullable=True,
        )
        batch_op.alter_column(  # type: ignore
            "valid_to",
            existing_type=sa.TEXT(),
            type_=sa.String(),
            existing_nullable=True,
        )
        batch_op.alter_column(  # type: ignore
            "url",
            existing_type=sa.TEXT(),
            type_=sa.String(),
            existing_nullable=True,
        )
        batch_op.alter_column(  # type: ignore
            "img_url",
            existing_type=sa.TEXT(),
            type_=sa.String(),
            existing_nullable=True,
        )
        batch_op.alter_column(  # type: ignore
            "gameinfo",
            existing_type=sa.TEXT(),
            type_=sa.String(),
            existing_nullable=True,
        )


def downgrade() -> None:
    with op.batch_alter_table("loot", schema=None) as batch_op:
        batch_op.alter_column(  # type: ignore
            "gameinfo",
            existing_type=sa.String(),
            type_=sa.TEXT(),
            existing_nullable=True,
        )
        batch_op.alter_column(  # type: ignore
            "img_url",
            existing_type=sa.String(),
            type_=sa.TEXT(),
            existing_nullable=True,
        )
        batch_op.alter_column(  # type: ignore
            "url",
            existing_type=sa.String(),
            type_=sa.TEXT(),
            existing_nullable=True,
        )
        batch_op.alter_column(  # type: ignore
            "valid_to",
            existing_type=sa.String(),
            type_=sa.TEXT(),
            existing_nullable=True,
        )
        batch_op.alter_column(  # type: ignore
            "valid_from",
            existing_type=sa.String(),
            type_=sa.TEXT(),
            existing_nullable=True,
        )
        batch_op.alter_column(  # type: ignore
            "publisher",
            existing_type=sa.String(),
            type_=sa.TEXT(),
            existing_nullable=True,
        )
        batch_op.alter_column(  # type: ignore
            "subtitle",
            existing_type=sa.String(),
            type_=sa.TEXT(),
            existing_nullable=True,
        )
        batch_op.alter_column(  # type: ignore
            "title",
            existing_type=sa.String(),
            type_=sa.TEXT(),
            existing_nullable=True,
        )
        batch_op.alter_column(  # type: ignore
            "rawtext",
            existing_type=sa.String(),
            type_=sa.TEXT(),
            existing_nullable=True,
        )
        batch_op.alter_column(  # type: ignore
            "type",
            existing_type=sa.String(),
            type_=sa.TEXT(),
            existing_nullable=True,
        )
        batch_op.alter_column(  # type: ignore
            "source",
            existing_type=sa.String(),
            type_=sa.TEXT(),
            existing_nullable=True,
        )
        batch_op.alter_column(  # type: ignore
            "seen_last",
            existing_type=sa.String(),
            type_=sa.TEXT(),
            existing_nullable=True,
        )
        batch_op.alter_column(  # type: ignore
            "seen_first",
            existing_type=sa.String(),
            type_=sa.TEXT(),
            existing_nullable=True,
        )

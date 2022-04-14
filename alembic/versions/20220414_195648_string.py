"""String columns

Revision ID: d0cab9037616
Revises: f2ce7aba3802
Create Date: 2022-04-14 19:56:48.664279+00:00

"""
import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "d0cab9037616"
down_revision = "f2ce7aba3802"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("loot", schema=None) as batch_op:  # type: ignore
        batch_op.alter_column(
            "seen_first",
            existing_type=sa.TEXT(),
            type_=sa.String(),
            existing_nullable=True,
        )
        batch_op.alter_column(
            "seen_last",
            existing_type=sa.TEXT(),
            type_=sa.String(),
            existing_nullable=True,
        )
        batch_op.alter_column(
            "source",
            existing_type=sa.TEXT(),
            type_=sa.String(),
            existing_nullable=True,
        )
        batch_op.alter_column(
            "type",
            existing_type=sa.TEXT(),
            type_=sa.String(),
            existing_nullable=True,
        )
        batch_op.alter_column(
            "rawtext",
            existing_type=sa.TEXT(),
            type_=sa.String(),
            existing_nullable=True,
        )
        batch_op.alter_column(
            "title",
            existing_type=sa.TEXT(),
            type_=sa.String(),
            existing_nullable=True,
        )
        batch_op.alter_column(
            "subtitle",
            existing_type=sa.TEXT(),
            type_=sa.String(),
            existing_nullable=True,
        )
        batch_op.alter_column(
            "publisher",
            existing_type=sa.TEXT(),
            type_=sa.String(),
            existing_nullable=True,
        )
        batch_op.alter_column(
            "valid_from",
            existing_type=sa.TEXT(),
            type_=sa.String(),
            existing_nullable=True,
        )
        batch_op.alter_column(
            "valid_to",
            existing_type=sa.TEXT(),
            type_=sa.String(),
            existing_nullable=True,
        )
        batch_op.alter_column(
            "url",
            existing_type=sa.TEXT(),
            type_=sa.String(),
            existing_nullable=True,
        )
        batch_op.alter_column(
            "img_url",
            existing_type=sa.TEXT(),
            type_=sa.String(),
            existing_nullable=True,
        )
        batch_op.alter_column(
            "gameinfo",
            existing_type=sa.TEXT(),
            type_=sa.String(),
            existing_nullable=True,
        )


def downgrade() -> None:
    with op.batch_alter_table("loot", schema=None) as batch_op:  # type: ignore
        batch_op.alter_column(
            "gameinfo",
            existing_type=sa.String(),
            type_=sa.TEXT(),
            existing_nullable=True,
        )
        batch_op.alter_column(
            "img_url",
            existing_type=sa.String(),
            type_=sa.TEXT(),
            existing_nullable=True,
        )
        batch_op.alter_column(
            "url",
            existing_type=sa.String(),
            type_=sa.TEXT(),
            existing_nullable=True,
        )
        batch_op.alter_column(
            "valid_to",
            existing_type=sa.String(),
            type_=sa.TEXT(),
            existing_nullable=True,
        )
        batch_op.alter_column(
            "valid_from",
            existing_type=sa.String(),
            type_=sa.TEXT(),
            existing_nullable=True,
        )
        batch_op.alter_column(
            "publisher",
            existing_type=sa.String(),
            type_=sa.TEXT(),
            existing_nullable=True,
        )
        batch_op.alter_column(
            "subtitle",
            existing_type=sa.String(),
            type_=sa.TEXT(),
            existing_nullable=True,
        )
        batch_op.alter_column(
            "title",
            existing_type=sa.String(),
            type_=sa.TEXT(),
            existing_nullable=True,
        )
        batch_op.alter_column(
            "rawtext",
            existing_type=sa.String(),
            type_=sa.TEXT(),
            existing_nullable=True,
        )
        batch_op.alter_column(
            "type",
            existing_type=sa.String(),
            type_=sa.TEXT(),
            existing_nullable=True,
        )
        batch_op.alter_column(
            "source",
            existing_type=sa.String(),
            type_=sa.TEXT(),
            existing_nullable=True,
        )
        batch_op.alter_column(
            "seen_last",
            existing_type=sa.String(),
            type_=sa.TEXT(),
            existing_nullable=True,
        )
        batch_op.alter_column(
            "seen_first",
            existing_type=sa.String(),
            type_=sa.TEXT(),
            existing_nullable=True,
        )

"""Channels

Revision ID: d2c85b75ece0
Revises: 0c70d4e1546c
Create Date: 2022-11-10 21:48:22.151004+00:00

"""
# pylint: disable=no-member
import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "d2c85b75ece0"
down_revision = "0c70d4e1546c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.alter_column(  # type: ignore
            "telegram_id",
            existing_type=sa.INTEGER(),
            type_=sa.String(),
            existing_nullable=True,
        )
        batch_op.alter_column(  # type: ignore
            "telegram_chat_id",
            existing_type=sa.INTEGER(),
            type_=sa.String(),
            existing_nullable=True,
        )


def downgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.alter_column(  # type: ignore
            "telegram_chat_id",
            existing_type=sa.String(),
            type_=sa.INTEGER(),
            existing_nullable=True,
        )
        batch_op.alter_column(  # type: ignore
            "telegram_id",
            existing_type=sa.String(),
            type_=sa.INTEGER(),
            existing_nullable=True,
        )

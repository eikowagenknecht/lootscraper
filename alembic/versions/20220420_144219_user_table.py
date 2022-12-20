"""User table

Revision ID: 8cfaaf08b306
Revises: 038c26b62555
Create Date: 2022-04-20 14:42:19.402926+00:00

"""
# pylint: disable=no-member

import sqlalchemy as sa

from alembic import op
from app.database import AwareDateTime

# revision identifiers, used by Alembic.
revision = "8cfaaf08b306"
down_revision = "038c26b62555"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("registration_date", AwareDateTime(), nullable=True),
        sa.Column("offers_received_count", sa.Integer(), nullable=True),
        sa.Column("telegram_id", sa.Integer(), nullable=True),
        sa.Column("telegram_chat_id", sa.Integer(), nullable=True),
        sa.Column("telegram_user_details", sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "telegram_subscriptions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column(
            "source",
            sa.Enum("AMAZON", "EPIC", "STEAM", "GOG", name="source"),
            nullable=False,
        ),
        sa.Column("type", sa.Enum("LOOT", "GAME", name="offertype"), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("telegram_subscriptions")
    op.drop_table("users")

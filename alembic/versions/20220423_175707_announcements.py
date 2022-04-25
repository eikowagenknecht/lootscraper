"""Announcements

Revision ID: fc43de437432
Revises: 52ea632ee417
Create Date: 2022-04-23 17:57:07.548114+00:00

"""
import sqlalchemy as sa

from alembic import op
from app.sqlalchemy import AwareDateTime

# revision identifiers, used by Alembic.
revision = "fc43de437432"
down_revision = "52ea632ee417"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "announcements",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "channel",
            sa.Enum("ALL", "FEED", "TELEGRAM", name="channel"),
            nullable=False,
        ),
        sa.Column("date", AwareDateTime(), nullable=False),
        sa.Column("text_markdown", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("users", schema=None) as batch_op:  # type: ignore
        batch_op.add_column(
            sa.Column("last_announcement_id", sa.Integer(), nullable=True)
        )
    op.execute("UPDATE users SET last_announcement_id = 0")
    with op.batch_alter_table("users", schema=None) as batch_op:  # type: ignore
        batch_op.alter_column(
            "last_announcement_id", existing_type=sa.Integer(), nullable=False
        )


def downgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:  # type: ignore
        batch_op.drop_column("last_announcement_id")

    op.drop_table("announcements")

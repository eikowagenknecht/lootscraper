"""Legacy

Revision ID: f2ce7aba3802
Revises:
Create Date: 2022-04-14 19:17:05.517698+00:00

"""
import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "f2ce7aba3802"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "loot",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("seen_first", sa.TEXT(), nullable=True),
        sa.Column("seen_last", sa.TEXT(), nullable=True),
        sa.Column("source", sa.TEXT(), nullable=True),
        sa.Column("type", sa.TEXT(), nullable=True),
        sa.Column("rawtext", sa.TEXT(), nullable=True),
        sa.Column("title", sa.TEXT(), nullable=True),
        sa.Column("subtitle", sa.TEXT(), nullable=True),
        sa.Column("publisher", sa.TEXT(), nullable=True),
        sa.Column("valid_from", sa.TEXT(), nullable=True),
        sa.Column("valid_to", sa.TEXT(), nullable=True),
        sa.Column("url", sa.TEXT(), nullable=True),
        sa.Column("img_url", sa.TEXT(), nullable=True),
        sa.Column("gameinfo", sa.TEXT(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("loot")

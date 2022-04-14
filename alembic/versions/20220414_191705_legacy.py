"""Legacy

Revision ID: f2ce7aba3802
Revises:
Create Date: 2022-04-14 19:17:05.517698+00:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f2ce7aba3802"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "loot",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("seen_first", sa.String(), nullable=True),
        sa.Column("seen_last", sa.String(), nullable=True),
        sa.Column("source", sa.String(), nullable=True),
        sa.Column("type", sa.String(), nullable=True),
        sa.Column("rawtext", sa.String(), nullable=True),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("subtitle", sa.String(), nullable=True),
        sa.Column("publisher", sa.String(), nullable=True),
        sa.Column("valid_from", sa.String(), nullable=True),
        sa.Column("valid_to", sa.String(), nullable=True),
        sa.Column("url", sa.String(), nullable=True),
        sa.Column("img_url", sa.String(), nullable=True),
        sa.Column("gameinfo", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    op.drop_table("loot")
    # ### end Alembic commands ###

"""Add timezone to user

Revision ID: c56fa72c6962
Revises: ebc6ef467953
Create Date: 2022-10-15 06:43:03.985276+00:00

"""
# pylint: disable=no-member

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "c56fa72c6962"
down_revision = "ebc6ef467953"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(sa.Column("timezone_offset", sa.Integer(), nullable=True))  # type: ignore


def downgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_column("timezone_offset")  # type: ignore

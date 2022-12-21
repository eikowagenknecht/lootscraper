"""Inactive Users

Revision ID: 0c70d4e1546c
Revises: c56fa72c6962
Create Date: 2022-10-16 08:18:44.092508+00:00

"""
# pylint: disable=no-member

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "0c70d4e1546c"
down_revision = "c56fa72c6962"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(sa.Column("inactive", sa.String(), nullable=True))  # type: ignore


def downgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_column("inactive")  # type: ignore

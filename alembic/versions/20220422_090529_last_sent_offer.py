"""Last sent offer

Revision ID: 52ea632ee417
Revises: 8cfaaf08b306
Create Date: 2022-04-22 09:05:29.092417+00:00

"""
import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "52ea632ee417"
down_revision = "8cfaaf08b306"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("offers", schema=None) as batch_op:  # type: ignore
        batch_op.alter_column("seen_first", existing_type=sa.DATETIME(), nullable=False)
        batch_op.alter_column("seen_last", existing_type=sa.DATETIME(), nullable=False)

    with op.batch_alter_table(  # type: ignore
        "telegram_subscriptions", schema=None
    ) as batch_op:
        batch_op.add_column(sa.Column("last_offer_id", sa.Integer(), nullable=True))

    op.execute("UPDATE telegram_subscriptions SET last_offer_id = 0")

    with op.batch_alter_table(  # type: ignore
        "telegram_subscriptions", schema=None
    ) as batch_op:
        batch_op.alter_column(
            "last_offer_id", existing_type=sa.Integer(), nullable=False
        )


def downgrade() -> None:
    with op.batch_alter_table("telegram_subscriptions", schema=None) as batch_op:  # type: ignore
        batch_op.drop_column("last_offer_id")

    with op.batch_alter_table("offers", schema=None) as batch_op:  # type: ignore
        batch_op.alter_column("seen_last", existing_type=sa.DATETIME(), nullable=True)
        batch_op.alter_column("seen_first", existing_type=sa.DATETIME(), nullable=True)

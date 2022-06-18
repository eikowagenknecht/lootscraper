"""Add offer duration

Revision ID: 254444f3560f
Revises: fc43de437432
Create Date: 2022-06-18 15:36:19.169481+00:00

"""
import sqlalchemy as sa
from sqlalchemy import orm, select

from alembic import op
from app.common import OfferDuration
from app.sqlalchemy import Offer, TelegramSubscription

# revision identifiers, used by Alembic.
revision = "254444f3560f"
down_revision = "fc43de437432"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1 - Add new column as nullable
    with op.batch_alter_table("offers", schema=None) as batch_op:  # type: ignore
        batch_op.add_column(
            sa.Column(
                "duration",
                sa.Enum(
                    "ALWAYS_FREE",
                    "PERMANENT_CLAIMABLE",
                    "TEMPORARY",
                    name="offerduration",
                ),
                nullable=True,
            )
        )

    with op.batch_alter_table("telegram_subscriptions", schema=None) as batch_op:  # type: ignore
        batch_op.add_column(
            sa.Column(
                "duration",
                sa.Enum(
                    "ALWAYS_FREE",
                    "PERMANENT_CLAIMABLE",
                    "TEMPORARY",
                    name="offerduration",
                ),
                nullable=True,
            )
        )

    # 2 - Fill it
    bind = op.get_bind()
    with orm.Session(bind=bind) as session:
        offer: Offer
        for offer in session.scalars(select(Offer)).all():
            offer.duration = OfferDuration.PERMANENT_CLAIMABLE

        sub: TelegramSubscription
        for sub in session.scalars(select(TelegramSubscription)).all():
            sub.duration = OfferDuration.PERMANENT_CLAIMABLE

        session.commit()

    # 3 - Make it non-nullable
    with op.batch_alter_table("offers", schema=None) as batch_op:  # type: ignore
        batch_op.alter_column("duration", nullable=False)

    with op.batch_alter_table("telegram_subscriptions", schema=None) as batch_op:  # type: ignore
        batch_op.alter_column("duration", nullable=False)


def downgrade() -> None:
    with op.batch_alter_table("offers", schema=None) as batch_op:  # type: ignore
        batch_op.drop_column("duration")

    with op.batch_alter_table("telegram_subscriptions", schema=None) as batch_op:  # type: ignore
        batch_op.drop_column("duration")

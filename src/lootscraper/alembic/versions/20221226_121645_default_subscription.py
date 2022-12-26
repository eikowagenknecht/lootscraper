"""Default subscription

Revision ID: 023117ae895e
Revises: f3b607e8b9bd
Create Date: 2022-12-26 12:16:45.624500+00:00

"""
# pylint: disable=no-member
from alembic import op
from sqlalchemy import orm

from lootscraper.common import OfferDuration, OfferType, Source
from lootscraper.database import TelegramSubscription, User

# revision identifiers, used by Alembic.
revision = "023117ae895e"
down_revision = "f3b607e8b9bd"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    with orm.Session(bind=bind) as session:
        user: User

        # Delete all invalid offers
        for user in session.query(User):
            if (
                user.telegram_subscriptions is None
                or len(user.telegram_subscriptions) == 0
            ):
                session.add(
                    TelegramSubscription(
                        user=user,
                        source=Source.STEAM,
                        type=OfferType.GAME,
                        duration=OfferDuration.CLAIMABLE,
                    )
                )

                session.add(
                    TelegramSubscription(
                        user=user,
                        source=Source.GOG,
                        type=OfferType.GAME,
                        duration=OfferDuration.CLAIMABLE,
                    )
                )

                session.add(
                    TelegramSubscription(
                        user=user,
                        source=Source.EPIC,
                        type=OfferType.GAME,
                        duration=OfferDuration.CLAIMABLE,
                    )
                )

        session.commit()

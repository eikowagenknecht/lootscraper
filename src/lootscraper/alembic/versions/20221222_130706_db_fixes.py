"""DB fixes

Revision ID: f3b607e8b9bd
Revises: 134d2f5d6d80
Create Date: 2022-12-22 13:07:06.860362+00:00

"""
# pylint: disable=no-member
import sqlalchemy as sa
from alembic import op
from sqlalchemy import orm

from lootscraper.common import Category
from lootscraper.database import Offer

# revision identifiers, used by Alembic.
revision = "f3b607e8b9bd"
down_revision = "134d2f5d6d80"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    with orm.Session(bind=bind) as session:
        offer: Offer

        # Delete all invalid offers
        for offer in session.query(Offer):
            if offer.category in [Category.DEMO, Category.PRERELEASE]:
                session.delete(offer)

        session.commit()

        # Fix all invalid img_urls
        for offer in session.query(Offer):
            if offer.img_url in ("", "None"):
                offer.img_url = None

        session.commit()

    with op.batch_alter_table("offers", schema=None) as batch_op:
        batch_op.alter_column(  # type: ignore
            "category",
            existing_type=sa.VARCHAR(length=5),
            type_=sa.Enum("VALID", "CHEAP", "DEMO", "PRERELEASE", name="category"),
            existing_nullable=False,
        )

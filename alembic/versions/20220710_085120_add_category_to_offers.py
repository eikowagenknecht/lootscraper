"""Add category to offers

Revision ID: ebc6ef467953
Revises: 254444f3560f
Create Date: 2022-07-10 08:51:20.622359+00:00

"""
import sqlalchemy as sa
from sqlalchemy import orm, select

from alembic import op
from app.common import Category
from app.sqlalchemy import Offer

# revision identifiers, used by Alembic.
revision = "ebc6ef467953"
down_revision = "254444f3560f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1 - Add new column as nullable
    with op.batch_alter_table("offers", schema=None) as batch_op:  # type: ignore
        batch_op.add_column(
            sa.Column(
                "category",
                sa.Enum(
                    "VALID",
                    "DEMO",
                    "CHEAP",
                    "ALWAYS_FREE",
                    name="category",
                ),
                nullable=True,
            )
        )

    # 2 - Fill it
    bind = op.get_bind()
    with orm.Session(bind=bind) as session:
        offer: Offer
        for offer in session.scalars(select(Offer)).all():
            offer.category = Category.VALID

        session.commit()

    # 3 - Make it non-nullable
    with op.batch_alter_table("offers", schema=None) as batch_op:  # type: ignore
        batch_op.alter_column("category", nullable=False)


def downgrade() -> None:
    with op.batch_alter_table("offers", schema=None) as batch_op:  # type: ignore
        batch_op.drop_column("category")

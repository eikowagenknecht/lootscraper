"""
Revamp Telegram.

Revision ID: 8338a761b831
Revises: 023117ae895e
Create Date: 2023-10-27 11:56:22.363419+00:00

"""

import json
import logging

import sqlalchemy as sa
from alembic import op
from sqlalchemy import orm
from telegram.constants import ChatType

from lootscraper.database import AwareDateTime, Base, TelegramChat

# revision identifiers, used by Alembic.
revision = "8338a761b831"
down_revision = "023117ae895e"
branch_labels = None
depends_on = None


class TempUser(Base):
    __tablename__ = "users"

    id = sa.Column(sa.Integer, primary_key=True)  # noqa: A003
    registration_date = sa.Column(AwareDateTime, nullable=False)
    telegram_id = sa.Column(sa.String, nullable=True)
    telegram_chat_id = sa.Column(sa.String)
    telegram_user_details = sa.Column(sa.JSON)
    timezone_offset = sa.Column(sa.Integer)
    inactive = sa.Column(sa.String, default=None)
    offers_received_count = sa.Column(sa.Integer, default=0)
    last_announcement_id = sa.Column(sa.Integer, default=0)


def upgrade() -> None:
    # First create the telegram_chats table
    logging.info("Creating new telegram_chats table")
    op.create_table(
        "telegram_chats",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("registration_date", AwareDateTime(), nullable=False),
        sa.Column("chat_type", sa.Enum(ChatType), nullable=False),
        sa.Column("chat_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("thread_id", sa.Integer(), nullable=True),
        sa.Column("chat_details", sa.JSON(), nullable=True),
        sa.Column("user_details", sa.JSON(), nullable=True),
        sa.Column("timezone_offset", sa.Integer(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("inactive_reason", sa.String(), nullable=True),
        sa.Column("offers_received_count", sa.Integer(), nullable=False),
        sa.Column("last_announcement_id", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # Fill the new table with data from the old one
    bind = op.get_bind()
    with orm.Session(bind=bind) as session:
        seen_chat_ids = set()
        for user in session.query(TempUser):
            if user.telegram_chat_id in seen_chat_ids:
                logging.warning(f"Skipping duplicate chat {user.telegram_chat_id}")
                continue
            seen_chat_ids.add(user.telegram_chat_id)
            logging.info(f"Migrating user {user.id}")

            # Determine chat type
            if "Channel user created by admin" in user.telegram_user_details:
                chat_type = ChatType.CHANNEL
                user_details = None
            elif int(user.telegram_chat_id) < 0:
                chat_type = ChatType.GROUP
                user_details = user.telegram_user_details
            else:
                chat_type = ChatType.PRIVATE
                user_details = user.telegram_user_details

            user_id = int(user.telegram_id) if int(user.telegram_id) > 0 else None

            if user_details and not isinstance(user_details, dict):
                user_details = json.loads(user_details)  # type: ignore

            new_chat = TelegramChat(
                registration_date=user.registration_date,
                user_id=user_id,
                chat_id=int(user.telegram_chat_id),
                user_details=user_details,
                chat_details=None,
                timezone_offset=user.timezone_offset,
                active=user.inactive is None,
                inactive_reason=user.inactive,
                offers_received_count=user.offers_received_count,
                last_announcement_id=user.last_announcement_id,
                chat_type=chat_type,
            )
            # Keep the primary key!
            new_chat.id = user.id
            session.add(new_chat)

        session.commit()

    # Drop all foreign keys workaround. They can't be dropped directly because
    # they have no name.
    conn = op.get_bind()
    # Disable foreign key constraint temporarily
    conn.execute(sa.text("PRAGMA foreign_keys=off;"))
    conn.execute(
        sa.text(
            """
            CREATE TABLE "new_telegram_subscriptions" (
                "id"	INTEGER NOT NULL,
                "chat_id"	INTEGER NOT NULL,
                "source"	VARCHAR(7) NOT NULL,
                "type"	VARCHAR(4) NOT NULL,
                "last_offer_id"	INTEGER NOT NULL,
                "duration"	VARCHAR(9) NOT NULL,
                CONSTRAINT "fk_telegram_subscriptions_chat_id_telegram_chats"
                FOREIGN KEY("chat_id")
                REFERENCES "telegram_chats"("id"),
                CONSTRAINT "pk_telegram_subscriptions"
                PRIMARY KEY("id")
                );
            """,
        ),
    )
    conn.execute(
        sa.text(
            """
                INSERT INTO new_telegram_subscriptions
                (id, chat_id, source, type, last_offer_id, duration)
                SELECT id, user_id, source, type, last_offer_id, duration
                FROM telegram_subscriptions;
            """,
        ),
    )
    conn.execute(sa.text("DROP TABLE telegram_subscriptions;"))
    conn.execute(
        sa.text(
            "ALTER TABLE new_telegram_subscriptions RENAME TO telegram_subscriptions;",
        ),
    )
    conn.execute(sa.text("PRAGMA foreign_keys=on;"))  # Enable back the foreign keys

    # At last, drop the old users table
    op.drop_table("users")

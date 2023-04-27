"""Initial SQLAlchemy 2.0

Revision ID: 023117ae895e
Revises: ---
Create Date: 2023-02-02 10:07:20.108271+00:00

"""

# pylint: disable=no-member

import sqlalchemy as sa
from lootscraper.database import AwareDateTime

from alembic import op

# revision identifiers, used by Alembic.
revision = "023117ae895e"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "announcements",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "channel",
            sa.Enum("ALL", "FEED", "TELEGRAM", name="channel"),
            nullable=False,
        ),
        sa.Column("date", AwareDateTime(), nullable=False),
        sa.Column("text_markdown", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "igdb_info",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("url", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("short_description", sa.String(), nullable=True),
        sa.Column("release_date", AwareDateTime(), nullable=True),
        sa.Column("user_score", sa.Integer(), nullable=True),
        sa.Column("user_ratings", sa.Integer(), nullable=True),
        sa.Column("meta_score", sa.Integer(), nullable=True),
        sa.Column("meta_ratings", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "steam_info",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("url", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("short_description", sa.String(), nullable=True),
        sa.Column("release_date", AwareDateTime(), nullable=True),
        sa.Column("genres", sa.String(), nullable=True),
        sa.Column("publishers", sa.String(), nullable=True),
        sa.Column("image_url", sa.String(), nullable=True),
        sa.Column("recommendations", sa.Integer(), nullable=True),
        sa.Column("percent", sa.Integer(), nullable=True),
        sa.Column("score", sa.Integer(), nullable=True),
        sa.Column("metacritic_score", sa.Integer(), nullable=True),
        sa.Column("metacritic_url", sa.String(), nullable=True),
        sa.Column("recommended_price_eur", sa.Float(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "registration_date",
            AwareDateTime(),
            nullable=False,
        ),
        sa.Column("telegram_id", sa.String(), nullable=True),
        sa.Column("telegram_chat_id", sa.String(), nullable=False),
        sa.Column("telegram_user_details", sa.JSON(), nullable=True),
        sa.Column("timezone_offset", sa.Integer(), nullable=True),
        sa.Column("inactive", sa.String(), nullable=True),
        sa.Column("offers_received_count", sa.Integer(), nullable=False),
        sa.Column("last_announcement_id", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "games",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("igdb_id", sa.Integer(), nullable=True),
        sa.Column("steam_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["igdb_id"],
            ["igdb_info.id"],
        ),
        sa.ForeignKeyConstraint(
            ["steam_id"],
            ["steam_info.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "telegram_subscriptions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column(
            "source",
            sa.Enum(
                "APPLE",
                "AMAZON",
                "EPIC",
                "GOG",
                "GOOGLE",
                "HUMBLE",
                "ITCH",
                "STEAM",
                "UBISOFT",
                name="source",
            ),
            nullable=False,
        ),
        sa.Column("type", sa.Enum("GAME", "LOOT", name="offertype"), nullable=False),
        sa.Column(
            "duration",
            sa.Enum("ALWAYS", "CLAIMABLE", "TEMPORARY", name="offerduration"),
            nullable=False,
        ),
        sa.Column("last_offer_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "offers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "source",
            sa.Enum(
                "APPLE",
                "AMAZON",
                "EPIC",
                "GOG",
                "GOOGLE",
                "HUMBLE",
                "ITCH",
                "STEAM",
                "UBISOFT",
                name="source",
            ),
            nullable=False,
        ),
        sa.Column("type", sa.Enum("GAME", "LOOT", name="offertype"), nullable=False),
        sa.Column(
            "duration",
            sa.Enum("ALWAYS", "CLAIMABLE", "TEMPORARY", name="offerduration"),
            nullable=False,
        ),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("probable_game_name", sa.String(), nullable=False),
        sa.Column("seen_last", AwareDateTime(), nullable=False),
        sa.Column("rawtext", sa.JSON(), nullable=True),
        sa.Column("url", sa.String(), nullable=True),
        sa.Column("game_id", sa.Integer(), nullable=True),
        sa.Column(
            "category",
            sa.Enum("VALID", "CHEAP", "DEMO", "PRERELEASE", name="category"),
            nullable=False,
        ),
        sa.Column("img_url", sa.String(), nullable=True),
        sa.Column("seen_first", AwareDateTime(), nullable=True),
        sa.Column("valid_from", AwareDateTime(), nullable=True),
        sa.Column("valid_to", AwareDateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["game_id"],
            ["games.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("offers")
    op.drop_table("telegram_subscriptions")
    op.drop_table("games")
    op.drop_table("users")
    op.drop_table("steam_info")
    op.drop_table("igdb_info")
    op.drop_table("announcements")

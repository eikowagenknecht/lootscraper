from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import TYPE_CHECKING, Any, Self

import sqlalchemy as sa
from alembic import command
from alembic.config import Config as AlembicConfig
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    MappedAsDataclass,
    Session,
    mapped_column,
    relationship,
    scoped_session,
    sessionmaker,
)
from telegram.constants import ChatType

from lootscraper.common import (
    Category,
    Channel,
    OfferDuration,
    OfferType,
    Source,
)
from lootscraper.config import Config
from lootscraper.utils import calc_real_valid_to

if TYPE_CHECKING:
    from collections.abc import Sequence
    from types import TracebackType


logger = logging.getLogger(__name__)


# Naming convention for keys and constraints
convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

metadata_obj = sa.MetaData(naming_convention=convention)


class Base(MappedAsDataclass, DeclarativeBase):
    """Subclasses will be converted to dataclasses."""

    metadata = metadata_obj


class AwareDateTime(sa.TypeDecorator):  # type: ignore
    """Results returned as aware datetimes, not naive ones."""

    impl = sa.DateTime
    cache_ok = True

    def process_result_value(
        self,
        value: datetime | None,
        dialect: sa.Dialect,  # noqa: ARG002
    ) -> datetime | None:
        if value is not None:
            return value.replace(tzinfo=UTC)

        return None

    def process_bind_param(
        self,
        value: datetime | None,
        dialect: sa.Dialect,  # noqa: ARG002
    ) -> datetime | None:
        if value is not None:
            return value.replace(tzinfo=None)
        return value


class Announcement(Base):
    __tablename__ = "announcements"

    id: Mapped[int] = mapped_column(  # noqa: A003
        init=False,
        primary_key=True,
    )

    channel: Mapped[Channel] = mapped_column(sa.Enum(Channel))
    date: Mapped[datetime] = mapped_column(AwareDateTime)
    text_markdown: Mapped[str]


class Game(Base):
    """A game (e.g. "The Witcher 3")."""

    __tablename__ = "games"

    igdb_info: Mapped[IgdbInfo | None] = relationship(
        "IgdbInfo",
        back_populates="game",
        default=None,
    )
    steam_info: Mapped[SteamInfo | None] = relationship(
        "SteamInfo",
        back_populates="game",
        default=None,
    )

    id: Mapped[int] = mapped_column(  # noqa: A003
        init=False,
        primary_key=True,
    )
    igdb_id: Mapped[int | None] = mapped_column(
        sa.ForeignKey("igdb_info.id"),
        init=False,
    )
    steam_id: Mapped[int | None] = mapped_column(
        sa.ForeignKey("steam_info.id"),
        init=False,
    )


class IgdbInfo(Base):
    """Information about a game, gathered from IDGB."""

    __tablename__ = "igdb_info"

    id: Mapped[int] = mapped_column(  # noqa: A003
        primary_key=True,
    )

    game: Mapped[Game | None] = relationship(
        "Game",
        back_populates="igdb_info",
        default=None,
    )

    url: Mapped[str | None] = mapped_column(default=None)
    name: Mapped[str | None] = mapped_column(default=None)
    short_description: Mapped[str | None] = mapped_column(default=None)
    release_date: Mapped[datetime | None] = mapped_column(AwareDateTime, default=None)
    user_score: Mapped[int | None] = mapped_column(default=None)
    user_ratings: Mapped[int | None] = mapped_column(default=None)
    meta_score: Mapped[int | None] = mapped_column(default=None)
    meta_ratings: Mapped[int | None] = mapped_column(default=None)


class SteamInfo(Base):
    """Information about a game, gathered from Steam."""

    __tablename__ = "steam_info"

    id: Mapped[int] = mapped_column(  # noqa: A003
        primary_key=True,
    )
    url: Mapped[str]

    game: Mapped[Game | None] = relationship(
        "Game",
        back_populates="steam_info",
        default=None,
    )

    name: Mapped[str | None] = mapped_column(default=None)
    short_description: Mapped[str | None] = mapped_column(default=None)
    release_date: Mapped[datetime | None] = mapped_column(AwareDateTime, default=None)
    genres: Mapped[str | None] = mapped_column(default=None)
    publishers: Mapped[str | None] = mapped_column(default=None)
    image_url: Mapped[str | None] = mapped_column(default=None)
    recommendations: Mapped[int | None] = mapped_column(default=None)
    percent: Mapped[int | None] = mapped_column(default=None)
    score: Mapped[int | None] = mapped_column(default=None)
    metacritic_score: Mapped[int | None] = mapped_column(default=None)
    metacritic_url: Mapped[str | None] = mapped_column(default=None)
    recommended_price_eur: Mapped[float | None] = mapped_column(default=None)


class Offer(Base):
    """An offer, can be for a game or some other game related content (loot)."""

    __tablename__ = "offers"

    id: Mapped[int] = mapped_column(  # noqa: A003
        init=False,
        primary_key=True,
    )
    source: Mapped[Source] = mapped_column(sa.Enum(Source))
    type: Mapped[OfferType] = mapped_column(sa.Enum(OfferType))  # noqa: A003
    duration: Mapped[OfferDuration] = mapped_column(sa.Enum(OfferDuration))
    title: Mapped[str]
    probable_game_name: Mapped[str]
    seen_last: Mapped[datetime] = mapped_column(AwareDateTime)
    """The valid to date as seen on the website. Some websites sometimes remove
    the offer before this date."""
    rawtext: Mapped[dict[str, Any] | None] = mapped_column(sa.JSON)
    url: Mapped[str | None]
    game_id: Mapped[int | None] = mapped_column(
        sa.ForeignKey("games.id"),
        init=False,
    )
    category: Mapped[Category] = mapped_column(
        sa.Enum(Category),
        default=Category.VALID,
    )

    img_url: Mapped[str | None] = mapped_column(default=None)
    seen_first: Mapped[datetime | None] = mapped_column(AwareDateTime, default=None)
    valid_from: Mapped[datetime | None] = mapped_column(AwareDateTime, default=None)
    valid_to: Mapped[datetime | None] = mapped_column(AwareDateTime, default=None)

    game: Mapped[Game | None] = relationship(
        "Game",
        default=None,
    )

    def real_valid_to(self) -> datetime | None:
        """Calculate the real valid to date from valid_to and seen_last."""
        return calc_real_valid_to(self.seen_last, self.valid_to)


class TelegramChat(Base):
    """A Telegram chat. Can be a single user, a group or a channel."""

    __tablename__ = "telegram_chats"

    subscriptions: Mapped[list[TelegramSubscription]] = relationship(
        "TelegramSubscription",
        back_populates="chat",
        cascade="all, delete-orphan",
        init=False,
    )

    id: Mapped[int] = mapped_column(init=False, primary_key=True)  # noqa: A003
    registration_date: Mapped[datetime] = mapped_column(AwareDateTime)
    chat_type: Mapped[ChatType] = mapped_column(sa.Enum(ChatType))
    chat_id: Mapped[int]
    user_id: Mapped[int | None] = mapped_column(default=None)
    thread_id: Mapped[int | None] = mapped_column(default=None)
    chat_details: Mapped[dict[str, Any] | None] = mapped_column(sa.JSON, default=None)
    user_details: Mapped[dict[str, Any] | None] = mapped_column(sa.JSON, default=None)
    timezone_offset: Mapped[int] = mapped_column(default=0)
    active: Mapped[bool] = mapped_column(default=True)
    inactive_reason: Mapped[str | None] = mapped_column(default=None)
    offers_received_count: Mapped[int] = mapped_column(default=0)
    last_announcement_id: Mapped[int] = mapped_column(default=0)


class TelegramSubscription(Base):
    """Subscription of a chat to a category for Telegram notifications."""

    __tablename__ = "telegram_subscriptions"

    chat: Mapped[TelegramChat] = relationship(
        "TelegramChat",
        back_populates="subscriptions",
    )

    id: Mapped[int] = mapped_column(  # noqa: A003
        init=False,
        primary_key=True,
    )
    chat_id: Mapped[int] = mapped_column(
        sa.ForeignKey("telegram_chats.id"),
        init=False,
    )
    source: Mapped[Source] = mapped_column(sa.Enum(Source))
    type: Mapped[OfferType] = mapped_column(sa.Enum(OfferType))  # noqa: A003
    duration: Mapped[OfferDuration] = mapped_column(sa.Enum(OfferDuration))
    last_offer_id: Mapped[int] = mapped_column(default=0)


class LootDatabase:
    def __init__(self, echo: bool = False) -> None:
        # Run Alembic migrations first before we open a session
        self.initialize_or_update()

        db_file_path = Config.data_path() / Path(Config.get().database_file)
        self.engine = sa.create_engine(
            f"sqlite+pysqlite:///{db_file_path}",
            echo=echo,
            future=True,
        )
        session_factory = sessionmaker(bind=self.engine, future=True)
        self.Session = scoped_session(session_factory)
        # TODO: Can this be changed with SQLAlchemy 2.0 and
        # the removal of threaded execution?

    def __enter__(self) -> Self:
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        session: Session = self.Session()
        if isinstance(exc_value, Exception):
            session.rollback()
        else:
            session.commit()
        session.close()

    def initialize_or_update(self) -> None:
        logger.info("Running database migrations")
        alembic_cfg = AlembicConfig(
            "alembic.ini",
            attributes={"configure_logger": False},
        )
        command.upgrade(alembic_cfg, "head")

    def read_active_offers(
        self,
        time: datetime,
        *,
        type_: OfferType | None = None,
        source: Source | None = None,
        duration: OfferDuration | None = None,
        last_offer_id: int | None = None,
    ) -> Sequence[Offer]:
        session: Session = self.Session()

        # Build prefiltered query to reduce database load.
        # The detailled filtering is then handled after execution.
        query = sa.select(Offer).where(
            sa.and_(
                sa.or_(
                    # Offers that are definitely still active
                    Offer.valid_from <= time,
                    # For some offers we don't really know,
                    # we will filter this later.
                    Offer.valid_from.is_(None),
                ),
                sa.or_(
                    # Offers that are definitely still active
                    Offer.valid_to >= time,
                    # For some offers we don't really know, but...
                    Offer.valid_to.is_(None),
                    # ... when they have been seen in the last 24
                    # hours, we consider them active.
                    Offer.seen_last >= time - timedelta(days=1),
                ),
            ),
        )

        filter_conditions = []
        if type_ is not None:
            filter_conditions.append(Offer.type == type_)
        if source is not None:
            filter_conditions.append(Offer.source == source)
        if duration is not None:
            filter_conditions.append(Offer.duration == duration)
        if last_offer_id is not None:
            filter_conditions.append(Offer.id > last_offer_id)

        if filter_conditions:
            query = query.where(sa.and_(*filter_conditions))

        filtered_offers = []

        try:
            offers = session.execute(query).scalars().all()

            # Filter out offers that have a real end date that is in the future
            filtered_offers = [
                offer
                for offer in offers
                if (real_valid_to := offer.real_valid_to()) is None
                or real_valid_to > time
            ]

        except Exception:
            session.rollback()
            raise

        return filtered_offers

    def read_all(self) -> Sequence[Offer]:
        session: Session = self.Session()
        try:
            result = session.execute(sa.select(Offer)).scalars().all()
        except Exception:
            session.rollback()
            raise
        return result

    def read_all_segmented(
        self,
    ) -> dict[str, dict[str, dict[str, list[Offer]]]]:
        result = self.read_all()

        offers: dict[str, dict[str, dict[str, list[Offer]]]] = {}

        offer: Offer
        for offer in result:
            source: str = Source(offer.source).name
            type_: str = OfferType(offer.type).name
            duration: str = OfferDuration(offer.duration).name
            if source not in offers:
                offers[source] = {}
            if type_ not in offers[source]:
                offers[source][type_] = {}
            if duration not in offers[source][type_]:
                offers[source][type_][duration] = []

            offers[source][type_][duration].append(offer)

        return offers

    def find_offer(
        self,
        source: Source,
        type_: OfferType,
        duration: OfferDuration,
        title: str,
        valid_to: datetime | None,
    ) -> Offer | None:
        """
        Find an offer by its title and valid_to date. Valid_to is interpreted
        as "at most 1 day older or 1 day newer" to avoid getting duplicates
        for offers where the exact end date is not clear.

        Offers that previously had no valid_to date but now do have one are
        considered the same offer because some sites (Steam) add the "valid to"
        date only when the offer already has been there for a while.
        """
        statement = (
            sa.select(Offer)
            .where(Offer.source == source)
            .where(Offer.type == type_)
            .where(Offer.duration == duration)
            .where(Offer.title == title)
        )

        # If no valid to date is given in the search criteria, match offers
        # with any valid to date. This will also match offers that previously
        # had no valid to date but now do have one. This is necessary to
        # avoid duplicates for offers that previously had no valid to date.
        if valid_to is None:
            pass
            # statement = statement.where(Offer.valid_to.is_(None))  # type: ignore

        # If a valid to date is given in the search criteria, match offers
        # that have the same valid to date or are close to it. Also match
        # offers that previously had no valid to date.
        else:
            earliest_date = valid_to.replace(tzinfo=UTC) - timedelta(days=1)
            latest_date = valid_to.replace(tzinfo=UTC) + timedelta(days=1)
            statement = statement.where(
                sa.or_(
                    sa.and_(
                        Offer.valid_to >= earliest_date,  # type: ignore
                        Offer.valid_to <= latest_date,  # type: ignore
                    ),
                    Offer.valid_to.is_(None),
                ),
            )

        session: Session = self.Session()
        try:
            result: Sequence[Offer] = session.execute(statement).scalars().all()
        except Exception:
            session.rollback()
            raise

        if len(result) == 0:
            return None

        # If there is only one match, return it
        if len(result) == 1:
            return result[0]

        # If there are multiple matches, return the one that matches the valid_to date
        for result_offer in result:
            if result_offer.valid_to == valid_to:
                return result_offer

        # If there are multiple close matches, return the last (=newest)
        logger.warning(
            (
                f"Found multiple offers for {title} that are close to {valid_to}. "
                "Returning the newest of those.",
            ),
        )
        return result[-1]

    def find_offer_by_id(self, id_: int) -> Offer | None:
        statement = sa.select(Offer).where(Offer.id == id_)
        session: Session = self.Session()
        try:
            result = session.execute(statement).scalars().one_or_none()
        except Exception:
            session.rollback()
            raise

        return result

    def touch_db_offer(self, db_offer: Offer) -> None:
        db_offer.seen_last = datetime.now(tz=UTC)
        session: Session = self.Session()
        try:
            session.commit()
        except Exception:
            session.rollback()
            raise

    def update_db_offer(self, db_offer: Offer, new_offer: Offer) -> None:
        """
        Update an offer in the database with new data. This is used to update
        the offer with the real valid to date after it has been added to the
        offer.
        """
        self.touch_db_offer(db_offer)

        if db_offer.source != new_offer.source:
            raise ValueError("Can't change source of offer.")
        if db_offer.duration != new_offer.duration:
            raise ValueError("Can't change duration of offer.")
        if db_offer.type != new_offer.type:
            raise ValueError("Can't change type of offer.")

        if new_offer.valid_from and not db_offer.valid_from:
            db_offer.valid_from = new_offer.valid_from
        if new_offer.valid_to and not db_offer.valid_to:
            db_offer.valid_to = new_offer.valid_to

        if new_offer.rawtext and new_offer.rawtext != db_offer.rawtext:
            db_offer.rawtext = new_offer.rawtext
        if new_offer.url and not db_offer.url:
            db_offer.url = new_offer.url
        if new_offer.img_url and not db_offer.img_url:
            db_offer.img_url = new_offer.img_url

        if new_offer.game_id and not db_offer.game_id:
            db_offer.game_id = new_offer.game_id

        session: Session = self.Session()
        try:
            session.commit()
        except Exception:
            session.rollback()
            raise

    def add_offer(self, offer: Offer) -> None:
        offer.seen_first = offer.seen_last
        session: Session = self.Session()
        try:
            session.add(offer)
            session.commit()
        except Exception:
            session.rollback()
            raise

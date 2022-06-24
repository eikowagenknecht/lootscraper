from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import TracebackType
from typing import Any, Type

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    TypeDecorator,
    and_,
    create_engine,
    select,
)
from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.orm import Session, registry, relationship, scoped_session, sessionmaker

from alembic import command
from alembic.config import Config as AlembicConfig
from app.common import Category, Channel, OfferDuration, OfferType, Source
from app.configparser import Config

logger = logging.getLogger(__name__)

mapper_registry = registry()
Base = mapper_registry.generate_base()  # type: Any


class AwareDateTime(TypeDecorator):
    """Results returned as aware datetimes, not naive ones."""

    impl = DateTime
    cache_ok = True

    def process_result_value(
        self, value: datetime | None, dialect: Dialect
    ) -> datetime | None:
        if value is not None:
            return value.replace(tzinfo=timezone.utc)
        else:
            return None


class Announcement(Base):
    __tablename__ = "announcements"

    id: int = Column(Integer, primary_key=True, nullable=False)

    channel: Channel = Column(Enum(Channel), nullable=False)
    date: datetime = Column(AwareDateTime, nullable=False)
    text_markdown: str = Column(String, nullable=False)


class Game(Base):
    """A game (e.g. "The Witcher 3")."""

    __tablename__ = "games"

    id: int = Column(Integer, primary_key=True, nullable=False)

    igdb_id: int | None = Column(Integer, ForeignKey("igdb_info.id"))
    steam_id: int | None = Column(Integer, ForeignKey("steam_info.id"))

    igdb_info: IgdbInfo | None = relationship("IgdbInfo", back_populates="game")
    steam_info: SteamInfo | None = relationship("SteamInfo", back_populates="game")

    offers: list[Offer] = relationship("Offer", back_populates="game")

    def __repr__(self) -> str:
        return (
            "Game("
            f"id={self.id!r}, "
            f"igdb_id={self.igdb_id!r}, "
            f"steam_id={self.steam_id!r})"
        )


class IgdbInfo(Base):
    """Information about a Game, gathered from IDGB."""

    __tablename__ = "igdb_info"

    id: int = Column(Integer, primary_key=True, nullable=False)
    url: str = Column(String, nullable=False)

    name: str = Column(String, nullable=False)
    short_description: str | None = Column(String)
    release_date: datetime | None = Column(AwareDateTime)

    user_score: int | None = Column(Integer)
    user_ratings: int | None = Column(Integer)
    meta_score: int | None = Column(Integer)
    meta_ratings: int | None = Column(Integer)

    def __repr__(self) -> str:
        return (
            "IgdbInfo("
            f"id={self.id!r}, "
            f"url={self.url!r}, "
            f"name={self.name!r}, "
            f"short_description={self.short_description!r}, "
            f"user_score={self.user_score!r}, "
            f"user_rating={self.user_ratings!r}, "
            f"meta_score={self.meta_score!r}, "
            f"meta_rating={self.meta_ratings!r}, "
            f"release_date={self.release_date!r})"
        )

    game: Game = relationship("Game", back_populates="igdb_info")


class SteamInfo(Base):
    """Information about a Game, gathered from Steam."""

    __tablename__ = "steam_info"

    id: int = Column(Integer, primary_key=True, nullable=False)
    url: str = Column(String, nullable=False)

    name: str = Column(String, nullable=False)
    short_description: str | None = Column(String)
    release_date: datetime | None = Column(AwareDateTime)
    genres: str | None = Column(String)
    publishers: str | None = Column(String)
    image_url: str | None = Column(String)

    recommendations: int | None = Column(Integer)
    percent: int | None = Column(Integer)
    score: int | None = Column(Integer)
    metacritic_score: int | None = Column(Integer)
    metacritic_url: str | None = Column(String)

    recommended_price_eur: float | None = Column(Float)

    def __repr__(self) -> str:
        return (
            "SteamInfo("
            f"id={self.id!r}, "
            f"url={self.url!r}, "
            f"name={self.name!r}, "
            f"short_description={self.short_description!r}, "
            f"release_date={self.release_date!r}, "
            f"genres={self.genres!r}, "
            f"publishers={self.publishers!r}, "
            f"image_url={self.image_url!r}, "
            f"recommendations={self.recommendations!r}, "
            f"percent={self.percent!r}, "
            f"score={self.score!r}, "
            f"metacritic_score={self.metacritic_score!r}, "
            f"metacritic_url={self.metacritic_url!r}, "
            f"recommended_price_eur={self.recommended_price_eur!r})"
        )

    game: Game = relationship("Game", back_populates="steam_info")


class Offer(Base):
    """An offer, can be for a game or some other game related content (loot)."""

    __tablename__ = "offers"

    id: int = Column(Integer, primary_key=True, nullable=False)
    source: Source = Column(Enum(Source), nullable=False)
    type: OfferType = Column(Enum(OfferType), nullable=False)
    duration: OfferDuration = Column(Enum(OfferDuration), nullable=False)
    title: str = Column(String, nullable=False)
    probable_game_name: str = Column(String, nullable=False)

    seen_first: datetime = Column(AwareDateTime, nullable=False)
    seen_last: datetime = Column(AwareDateTime, nullable=False)
    valid_from: datetime | None = Column(AwareDateTime)
    valid_to: datetime | None = Column(AwareDateTime)

    rawtext: str | None = Column(String)
    url: str | None = Column(String)
    img_url: str | None = Column(String)

    category: Category = Category.VALID

    game_id: int | None = Column(Integer, ForeignKey("games.id"))
    game: Game | None = relationship("Game", back_populates="offers")

    def __repr__(self) -> str:
        return (
            "Offer("
            f"id={self.id!r}, "
            f"game_id={self.game_id!r}, "
            f"seen_first={self.seen_first!r}, "
            f"seen_last={self.seen_last!r}, "
            f"source={self.source!r}, "
            f"type={self.type!r}, "
            f"rawtext={self.rawtext!r}, "
            f"title={self.title!r}, "
            f"valid_from={self.valid_from!r}, "
            f"valid_to={self.valid_to!r}, "
            f"url={self.url!r}, "
            f"img_url={self.img_url!r}, "
        )


class User(Base):
    """A user of the website."""

    __tablename__ = "users"

    id: int = Column(Integer, primary_key=True, nullable=False)

    registration_date: datetime = Column(AwareDateTime)
    offers_received_count: int = Column(Integer, default=0)

    telegram_id: int | None = Column(Integer)
    telegram_chat_id: int | None = Column(Integer)
    telegram_user_details: str | None = Column(JSON)

    telegram_subscriptions: list[TelegramSubscription] = relationship(
        "TelegramSubscription", back_populates="user", cascade="all, delete-orphan"
    )

    last_announcement_id: int = Column(Integer, nullable=False, default=0)


class TelegramSubscription(Base):
    """Subscription of a user to a category for Telegram notifications."""

    __tablename__ = "telegram_subscriptions"

    id: int = Column(Integer, primary_key=True, nullable=False)

    user_id: int = Column(Integer, ForeignKey("users.id"), nullable=False)
    user: User = relationship("User", back_populates="telegram_subscriptions")

    source: Source = Column(Enum(Source), nullable=False)
    type: OfferType = Column(Enum(OfferType), nullable=False)
    duration: OfferDuration = Column(Enum(OfferDuration), nullable=False)

    last_offer_id: int = Column(Integer, nullable=False, default=0)


class LootDatabase:
    def __init__(self, echo: bool = False) -> None:
        # Run Alembic migrations first before we open a session
        self.initialize_or_update()

        db_file_path = Config.data_path() / Path(Config.get().database_file)
        self.engine = create_engine(
            f"sqlite+pysqlite:///{db_file_path}",
            echo=echo,
            future=True,
        )
        session_factory = sessionmaker(bind=self.engine)
        self.Session = scoped_session(session_factory)

    def __enter__(self) -> LootDatabase:
        return self

    def __exit__(
        self,
        exc_type: Type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        session: Session = self.Session()
        if isinstance(exc_value, Exception):
            session.rollback()
        else:
            session.commit()
        session.close()
        pass

    def initialize_or_update(self) -> None:
        logger.info("Running database migrations")
        alembic_cfg = AlembicConfig(
            "alembic.ini",
            attributes={"configure_logger": False},
        )
        command.upgrade(alembic_cfg, "head")

    def read_all(self) -> list[Offer]:
        session: Session = self.Session()
        result = session.execute(select(Offer)).scalars().all()
        return result

    def read_all_segmented(self) -> dict[str, dict[str, dict[str, list[Offer]]]]:
        result = self.read_all()

        offers: dict[str, dict[str, dict[str, list[Offer]]]] = {}

        offer: Offer
        for offer in result:
            source: str = Source(offer.source).name
            type: str = OfferType(offer.type).name
            duration: str = OfferDuration(offer.duration).name
            if source not in offers:
                offers[source] = {}
            if type not in offers[source]:
                offers[source][type] = {}
            if duration not in offers[source][type]:
                offers[source][type][duration] = []

            offers[source][type][duration].append(offer)

        return offers

    def find_offer(
        self,
        source: Source,
        type: OfferType,
        title: str,
        valid_to: datetime | None,
    ) -> Offer | None:
        """Find an offer by its title and valid_to date. Valid_to is interpreded as
        "at most 1 day older or 1 day newer" to avoid getting duplicates for offers
        where the exact end date is not clear (looking at you, Amazon!)"""
        statement = (
            select(Offer)
            .where(Offer.source == source)
            .where(Offer.type == type)
            .where(Offer.title == title)
        )

        if valid_to:
            earliest_date = valid_to.replace(tzinfo=timezone.utc) - timedelta(days=1)
            latest_date = valid_to.replace(tzinfo=timezone.utc) + timedelta(days=1)
            statement = statement.where(
                and_(
                    Offer.valid_to >= earliest_date,  # type: ignore
                    Offer.valid_to <= latest_date,  # type: ignore
                )
            )

        session: Session = self.Session()
        result: list[Offer] = session.execute(statement).scalars().all()

        if len(result) == 0:
            return None

        if len(result) > 1:
            logger.warning(
                f"Found multiple offers for {title} {valid_to}. Returning the first match."
            )

        return result[0]

    def find_offer_by_id(self, id: int) -> Offer:
        statement = select(Offer).where(Offer.id == id)
        session: Session = self.Session()
        result = session.execute(statement).scalars().one_or_none()

        return result

    def touch_db_offer(self, db_offer: Offer) -> None:
        db_offer.seen_last = datetime.now().replace(tzinfo=timezone.utc)
        session: Session = self.Session()
        session.commit()

    def update_db_offer(self, db_offer: Offer, new_data: Offer) -> None:
        db_offer.source = new_data.source
        db_offer.type = new_data.type
        db_offer.title = new_data.title

        if new_data.seen_first:
            db_offer.seen_first = new_data.seen_first
        if new_data.seen_last:
            db_offer.seen_last = new_data.seen_last
        if new_data.valid_from:
            db_offer.valid_from = new_data.valid_from
        if new_data.valid_to:
            db_offer.valid_to = new_data.valid_to

        if new_data.rawtext:
            db_offer.rawtext = new_data.rawtext
        if new_data.url:
            db_offer.url = new_data.url
        if new_data.img_url:
            db_offer.img_url = new_data.img_url

        if new_data.game_id:
            db_offer.game_id = new_data.game_id

        session: Session = self.Session()
        session.commit()

    def add_offer(self, offer: Offer) -> None:
        offer.seen_first = offer.seen_last
        session: Session = self.Session()
        session.add(offer)
        session.commit()

from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path
from types import TracebackType
from typing import Any, Type

from sqlalchemy import (
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
from sqlalchemy.orm import Session, registry, relationship

from alembic import command
from alembic.config import Config as AlembicConfig
from app.common import OfferType, Source
from app.configparser import Config

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


class Game(Base):
    __tablename__ = "games"

    id: int = Column(Integer, primary_key=True, nullable=False)

    # Steam scraped data
    steam_id: int | None = Column(Integer)
    steam_url: str | None = Column(String)
    steam_recommendations: int | None = Column(Integer)
    steam_percent: int | None = Column(Integer)
    steam_score: int | None = Column(Integer)
    metacritic_score: int | None = Column(Integer)
    metacritic_url: str | None = Column(String)
    recommended_price_eur: float | None = Column(Float)

    # IGDB scraped data
    igdb_id: int | None = Column(Integer)
    igdb_url: str | None = Column(String)
    igdb_user_score: int | None = Column(Integer)
    igdb_user_ratings: int | None = Column(Integer)
    igdb_meta_score: int | None = Column(Integer)
    igdb_meta_ratings: int | None = Column(Integer)

    # Could be from both
    name: str | None = Column(String)
    short_description: str | None = Column(String)
    genres: str | None = Column(String)  # Currently Steam only
    publishers: str | None = Column(String)  # Currently Steam only
    release_date: datetime | None = Column(AwareDateTime)
    image_url: str | None = Column(String)  # Currently Steam only

    offers: list[Offer] = relationship("Offer", back_populates="game")

    def __repr__(self) -> str:
        return (
            "Game("
            f"id={self.id!r}, "
            f"steam_id={self.steam_id!r}, "
            f"steam_url={self.steam_url!r}, "
            f"steam_recommendations={self.steam_recommendations!r}, "
            f"steam_percent={self.steam_percent!r}, "
            f"steam_score={self.steam_score!r}, "
            f"metacritic_score={self.metacritic_score!r}, "
            f"metacritic_url={self.metacritic_url!r}, "
            f"recommended_price_eur={self.recommended_price_eur!r}, "
            f"igdb_id={self.igdb_id!r}, "
            f"igdb_url={self.igdb_url!r}, "
            f"igdb_user_score={self.igdb_user_score!r}, "
            f"igdb_user_rating={self.igdb_user_ratings!r}, "
            f"igdb_meta_score={self.igdb_meta_score!r}, "
            f"igdb_meta_rating={self.igdb_meta_ratings!r}, "
            f"name={self.name!r}, "
            f"short_description={self.short_description!r}, "
            f"genres={self.genres!r}, "
            f"publishers={self.publishers!r}, "
            f"release_date={self.release_date!r}, "
            f"image_url={self.image_url!r}, "
            f"offers={self.offers!r}"
        )

    def add_missing_data(self, other: Game) -> None:
        if not self.steam_id:
            self.steam_id = other.steam_id
        if not self.steam_url:
            self.steam_url = other.steam_url
        if not self.steam_recommendations:
            self.steam_recommendations = other.steam_recommendations
        if not self.steam_percent:
            self.steam_percent = other.steam_percent
        if not self.steam_score:
            self.steam_score = other.steam_score
        if not self.metacritic_score:
            self.metacritic_score = other.metacritic_score
        if not self.metacritic_url:
            self.metacritic_url = other.metacritic_url
        if not self.recommended_price_eur:
            self.recommended_price_eur = other.recommended_price_eur

        if not self.igdb_id:
            self.igdb_id = other.igdb_id
        if not self.igdb_url:
            self.igdb_url = other.igdb_url
        if not self.igdb_user_score:
            self.igdb_user_score = other.igdb_user_score
        if not self.igdb_user_ratings:
            self.igdb_user_ratings = other.igdb_user_ratings
        if not self.igdb_meta_score:
            self.igdb_meta_score = other.igdb_meta_score
        if not self.igdb_meta_ratings:
            self.igdb_meta_ratings = other.igdb_meta_ratings

        if not self.name:
            self.name = other.name
        if not self.short_description:
            self.short_description = other.short_description
        if not self.genres:
            self.genres = other.genres
        if not self.publishers:
            self.publishers = other.publishers
        if not self.release_date:
            self.release_date = other.release_date
        if not self.image_url:
            self.image_url = other.image_url


class Offer(Base):
    __tablename__ = "offers"

    id: int = Column(Integer, primary_key=True, nullable=False)
    source: Source = Column(Enum(Source), nullable=False)
    type: OfferType = Column(Enum(OfferType), nullable=False)
    title: str = Column(String, nullable=False)
    probable_game_name: str = Column(String, nullable=False)

    seen_first: datetime | None = Column(AwareDateTime)
    seen_last: datetime | None = Column(AwareDateTime)
    valid_from: datetime | None = Column(AwareDateTime)
    valid_to: datetime | None = Column(AwareDateTime)

    rawtext: str | None = Column(String)
    url: str | None = Column(String)
    img_url: str | None = Column(String)

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

        self.session = Session(self.engine)

    def __enter__(self) -> LootDatabase:
        return self

    def __exit__(
        self,
        exc_type: Type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        if isinstance(exc_value, Exception):
            self.session.rollback()
        else:
            self.session.commit()
        self.session.close()
        pass

    def initialize_or_update(self) -> None:
        logging.info("Running database migrations")
        alembic_cfg = AlembicConfig(
            "alembic.ini",
            attributes={"configure_logger": False},
        )
        command.upgrade(alembic_cfg, "head")

    def read_all(self) -> list[Offer]:
        result = self.session.execute(select(Offer)).scalars().all()
        return result

    def read_all_segmented(self) -> dict[str, dict[str, list[Offer]]]:
        result = self.read_all()

        offers: dict[str, dict[str, list[Offer]]] = {}

        offer: Offer
        for offer in result:
            source: str = Source(offer.source).name
            type: str = OfferType(offer.type).name
            if source not in offers:
                offers[source] = {}
            if type not in offers[source]:
                offers[source][type] = []

            offers[source][type].append(offer)

        return offers

    def find_offer(
        self,
        source: Source,
        type: OfferType,
        title: str,
        valid_to: datetime | None,
    ) -> Offer:
        statement = select(Offer).where(
            and_(
                Offer.source == source,
                Offer.title == title,
                Offer.valid_to == valid_to.replace(tzinfo=timezone.utc)
                if valid_to
                else None,
            )
        )
        result = self.session.execute(statement).scalars().one_or_none()

        return result

    def find_offer_by_id(self, id: int) -> Offer:
        statement = select(Offer).where(Offer.id == id)
        result = self.session.execute(statement).scalars().one_or_none()

        return result

    def touch_db_offer(self, db_offer: Offer) -> None:
        db_offer.seen_last = datetime.now().replace(tzinfo=timezone.utc)

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

    def add_offer(self, offer: Offer) -> None:
        offer.seen_first = offer.seen_last

        self.session.add(offer)

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
    and_,
    create_engine,
    select,
)
from sqlalchemy.orm import Session, registry, relationship

from alembic import command
from alembic.config import Config as AlembicConfig
from app.common import LootOffer, OfferType, Source
from app.configparser import Config
from app.scraper.info.gameinfo import Gameinfo

mapper_registry = registry()
Base = mapper_registry.generate_base()  # type: Any


class OldLoot(Base):
    __tablename__ = "loot"
    id = Column(Integer, primary_key=True)
    seen_first = Column(DateTime)
    seen_last = Column(DateTime)
    source = Column(String)
    type = Column(String)
    rawtext = Column(String)
    title = Column(String)
    subtitle = Column(String)
    publisher = Column(String)
    valid_from = Column(DateTime)
    valid_to = Column(DateTime)
    url = Column(String)
    img_url = Column(String)
    gameinfo = Column(String)

    def __repr__(self) -> str:
        return (
            "OldLoot("
            f"id={self.id!r}, "
            f"seen_first={self.seen_first!r}, "
            f"seen_last={self.seen_last!r}, "
            f"source={self.source!r}, "
            f"type={self.type!r}, "
            f"rawtext={self.rawtext!r}, "
            f"title={self.title!r}, "
            f"subtitle={self.subtitle!r}, "
            f"publisher={self.publisher!r}, "
            f"valid_from={self.valid_from!r}, "
            f"valid_to={self.valid_to!r}, "
            f"url={self.url!r}, "
            f"img_url={self.img_url!r}, "
            f"gameinfo={self.gameinfo!r}"
        )


class Game(Base):
    __tablename__ = "games"

    id = Column(Integer, primary_key=True, nullable=False)

    # Steam scraped data
    steam_id = Column(Integer)
    steam_url = Column(String)
    steam_recommendations = Column(Integer)
    steam_percent = Column(Integer)
    steam_score = Column(Integer)
    metacritic_score = Column(Integer)
    metacritic_url = Column(String)
    recommended_price_eur = Column(Float)

    # IGDB scraped data
    igdb_id = Column(Integer)
    igdb_url = Column(String)
    igdb_user_score = Column(Integer)
    igdb_user_rating = Column(Integer)
    igdb_meta_score = Column(Integer)
    igdb_meta_rating = Column(Integer)

    # Could be from both
    name = Column(String)
    short_description = Column(String)
    genres = Column(String)  # Currently Steam only
    publishers = Column(String)  # Currently Steam only
    release_date = Column(DateTime)
    image_url = Column(String)  # Currently Steam only

    offers = relationship("Offer", back_populates="game")

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
            f"igdb_user_rating={self.igdb_user_rating!r}, "
            f"igdb_meta_score={self.igdb_meta_score!r}, "
            f"igdb_meta_rating={self.igdb_meta_rating!r}, "
            f"name={self.name!r}, "
            f"short_description={self.short_description!r}, "
            f"genres={self.genres!r}, "
            f"publishers={self.publishers!r}, "
            f"release_date={self.release_date!r}, "
            f"image_url={self.image_url!r}, "
            f"offers={self.offers!r}"
        )


class Offer(Base):
    __tablename__ = "offers"

    id = Column(Integer, primary_key=True)
    source = Column(Enum(Source))
    type = Column(Enum(OfferType))
    title = Column(String)

    seen_first = Column(DateTime)
    seen_last = Column(DateTime)
    valid_from = Column(DateTime)
    valid_to = Column(DateTime)

    rawtext = Column(String)
    url = Column(String)
    img_url = Column(String)

    game_id = Column(Integer, ForeignKey("games.id"))
    game = relationship("Game", back_populates="offers")

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


class OldLootDatabase:
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

    def __enter__(self) -> OldLootDatabase:
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

    def read_all(self) -> list[OldLoot]:
        result = self.session.execute(select(OldLoot)).scalars().all()
        return result

    def read_all_segmented(self) -> dict[str, dict[str, list[LootOffer]]]:
        result = self.read_all()

        offers: dict[str, dict[str, list[LootOffer]]] = {}

        for row in result:
            offer = self.get_loot_offer_from_db_row(row)

            source: str = Source(row.source).name
            type: str = OfferType(row.type).name
            if source not in offers:
                offers[source] = {}
            if type not in offers[source]:
                offers[source][type] = []

            offers[source][type].append(offer)

        return offers

    def find_offer(
        self,
        source: str | None,
        title: str | None,
        subtitle: str | None,
        valid_to: datetime | None,
    ) -> OldLoot:
        statement = select(OldLoot).where(
            and_(
                OldLoot.source == source,
                OldLoot.title == title,
                OldLoot.subtitle == subtitle,
                OldLoot.valid_to == valid_to.replace(tzinfo=timezone.utc)
                if valid_to
                else None,
            )
        )
        result = self.session.execute(statement).scalars().one_or_none()

        return result

    def find_offer_by_id(self, id: int) -> OldLoot:
        statement = select(OldLoot).where(OldLoot.id == id)
        result = self.session.execute(statement).scalars().one_or_none()

        return result

    def get_loot_offer_from_db_row(self, db_row: OldLoot) -> LootOffer:
        gameinfo: Gameinfo | None = (
            Gameinfo.from_json(db_row.gameinfo) if db_row.gameinfo else None
        )
        offer = LootOffer(
            id=db_row.id,
            source=Source(db_row.source),
            type=OfferType(db_row.type),
            title=db_row.title,
            subtitle=db_row.subtitle,
            publisher=db_row.publisher,
            valid_from=db_row.valid_from.replace(tzinfo=timezone.utc)
            if db_row.valid_from
            else None,
            valid_to=db_row.valid_to.replace(tzinfo=timezone.utc)
            if db_row.valid_to
            else None,
            seen_first=db_row.seen_first.replace(tzinfo=timezone.utc)
            if db_row.seen_first
            else None,
            seen_last=db_row.seen_last.replace(tzinfo=timezone.utc)
            if db_row.seen_last
            else None,
            url=db_row.url,
            img_url=db_row.img_url,
            gameinfo=gameinfo,
        )

        return offer

    def touch_db_row(self, db_row: OldLoot) -> None:
        db_row.seen_last = datetime.now().replace(tzinfo=timezone.utc)

    def update_db_row_with_loot_offer(
        self, offer: LootOffer, db_row: OldLoot
    ) -> None:
        db_row.rawtext = offer.rawtext or None
        db_row.source = offer.source.value if offer.source else None
        db_row.type = offer.type.value if offer.type else None
        db_row.title = offer.title or None
        db_row.subtitle = offer.subtitle or None
        db_row.publisher = offer.publisher or None
        db_row.valid_from = (
            offer.valid_from.replace(tzinfo=timezone.utc) if offer.valid_from else None
        )
        db_row.valid_to = (
            offer.valid_to.replace(tzinfo=timezone.utc) if offer.valid_to else None
        )
        db_row.url = offer.url or None
        db_row.img_url = offer.img_url or None
        db_row.gameinfo = offer.gameinfo.to_json() if offer.gameinfo else None
        db_row.seen_last = datetime.now().replace(tzinfo=timezone.utc)

    def add_loot_offer(self, offer: LootOffer) -> None:
        db_row = OldLoot()
        self.update_db_row_with_loot_offer(offer, db_row)

        current_date = datetime.now().replace(tzinfo=timezone.utc)
        db_row.seen_first = current_date
        db_row.seen_last = current_date

        self.session.add(db_row)

    def update_loot_offer(self, offer: LootOffer) -> None:
        if offer.id is None:
            return

        db_row = self.find_offer_by_id(offer.id)
        self.update_db_row_with_loot_offer(offer, db_row)

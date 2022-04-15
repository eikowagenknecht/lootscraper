from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path
from types import TracebackType
from typing import Any, Type

from sqlalchemy import Column, DateTime, Integer, String, and_, create_engine, select
from sqlalchemy.orm import Session, registry

from alembic import command
from alembic.config import Config as AlembicConfig
from app.common import LootOffer, OfferType, Source
from app.configparser import Config
from app.scraper.info.gameinfo import Gameinfo

mapper_registry = registry()
Base = mapper_registry.generate_base()  # type: Any


class OldDbLoot(Base):
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
            f""
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

    def read_all(self) -> list[OldDbLoot]:
        result = self.session.execute(select(OldDbLoot)).scalars().all()
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
    ) -> OldDbLoot:
        statement = select(OldDbLoot).where(
            and_(
                OldDbLoot.source == source,
                OldDbLoot.title == title,
                OldDbLoot.subtitle == subtitle,
                OldDbLoot.valid_to == valid_to.replace(tzinfo=timezone.utc)
                if valid_to
                else None,
            )
        )
        result = self.session.execute(statement).scalars().one_or_none()

        return result

    def find_offer_by_id(self, id: int) -> OldDbLoot:
        statement = select(OldDbLoot).where(OldDbLoot.id == id)
        result = self.session.execute(statement).scalars().one_or_none()

        return result

    def get_loot_offer_from_db_row(self, db_row: OldDbLoot) -> LootOffer:
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

    def touch_db_row(self, db_row: OldDbLoot) -> None:
        db_row.seen_last = datetime.now().replace(tzinfo=timezone.utc)

    def update_db_row_with_loot_offer(
        self, offer: LootOffer, db_row: OldDbLoot
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
        db_row = OldDbLoot()
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

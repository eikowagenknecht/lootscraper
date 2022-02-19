from __future__ import annotations

import sqlite3
from datetime import datetime
from pathlib import Path
from types import TracebackType
from typing import Final, Type

from app.configparser import Config

from .common import TIMESTAMP_LONG, LootOffer

DROP_LOOT_TABLE: Final = """DROP TABLE IF EXISTS loot"""
CREATE_LOOT_TABLE: Final = """CREATE TABLE IF NOT EXISTS "loot" (
    "id" INTEGER PRIMARY KEY,
    "seen_first" TEXT,
    "seen_last" TEXT,
    "source" TEXT,
    "type" TEXT,
    "rawtext" TEXT,
    "title" TEXT,
    "subtitle" TEXT,
    "publisher" TEXT,
    "valid_from" TEXT,
    "valid_to" TEXT,
    "url" TEXT
);"""


class LootDatabase:
    def __init__(self) -> None:
        path = Config.data_path() / Path(Config.config()["common"]["DatabaseFile"])

        self.connection = sqlite3.connect(path)
        self.cursor = self.connection.cursor()

    def __enter__(self) -> LootDatabase:
        return self

    def __exit__(
        self,
        exc_type: Type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        self.cursor.close()
        if isinstance(exc_value, Exception):
            self.connection.rollback()
        else:
            self.connection.commit()
        self.connection.close()

    def initialize_or_update(self) -> None:
        # self.cursor.execute(DROP_LOOT_TABLE)
        self.cursor.execute(CREATE_LOOT_TABLE)

    def touch_offer(self, db_offer: LootOffer) -> None:
        if db_offer.id is None:
            return

        current_date = datetime.now().strftime(TIMESTAMP_LONG)
        self.cursor.execute(
            """UPDATE loot
                SET seen_last = ?
                WHERE id = ?""",
            (current_date, db_offer.id),
        )

    def update_url(self, db_offer: LootOffer) -> None:
        """Helper method for migration."""

        if db_offer.id is None:
            return

        self.cursor.execute(
            """UPDATE loot
                SET url = ?
                WHERE id = ?""",
            (db_offer.url, db_offer.id),
        )

    def insert_offer(self, offer: LootOffer) -> None:
        current_date = datetime.now().strftime(TIMESTAMP_LONG)
        self.cursor.execute(
            """INSERT INTO loot(seen_first, seen_last, rawtext, source, type, title, subtitle, publisher, valid_from, valid_to, url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                current_date,
                current_date,
                offer.rawtext,
                offer.source,
                offer.type,
                offer.title,
                offer.subtitle,
                offer.publisher,
                offer.valid_from,
                offer.valid_to,
                offer.url,
            ),
        )

    def insert_offers(self, offers: list[LootOffer]) -> None:
        current_date = datetime.now().strftime(TIMESTAMP_LONG)
        for offer in offers:
            self.cursor.execute(
                """INSERT INTO loot(seen_first, seen_last, rawtext, source, type, title, subtitle, publisher, valid_from, valid_to, url)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    current_date,
                    current_date,
                    offer.rawtext,
                    offer.source,
                    offer.type,
                    offer.title,
                    offer.subtitle,
                    offer.publisher,
                    offer.valid_from,
                    offer.valid_to,
                    offer.url,
                ),
            )

    def read_offers(self) -> list[LootOffer]:
        self.cursor.execute(
            (
                "SELECT id"
                ", source"
                ", type"
                ", title"
                ", subtitle"
                ", publisher"
                ", valid_from"
                ", valid_to"
                ", seen_first"
                ", seen_last"
                ", url"
                " FROM loot"
                " ORDER BY type"
            )
        )
        offers = []

        for row in self.cursor:  # type: ignore
            offer = LootOffer(
                id=row[0],  # type: ignore
                source=row[1],  # type: ignore
                type=row[2],  # type: ignore
                title=row[3],  # type: ignore
                subtitle=row[4],  # type: ignore
                publisher=row[5],  # type: ignore
                valid_from=row[6],  # type: ignore
                valid_to=row[7],  # type: ignore
                seen_first=datetime.strptime(row[8], TIMESTAMP_LONG),  # type: ignore
                seen_last=datetime.strptime(row[9], TIMESTAMP_LONG),  # type: ignore
                url=row[10],  # type: ignore
            )
            offers.append(offer)

        return offers

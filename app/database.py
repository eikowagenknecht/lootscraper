from __future__ import annotations

import sqlite3
from datetime import date
from pathlib import Path
from types import TracebackType
from typing import Final, Type

from .common import DATEFORMAT, LootOffer

DB_NAME: Path = Path("loot.db")

DROP_LOOT_TABLE: Final = """DROP TABLE IF EXISTS loot"""
CREATE_LOOT_TABLE: Final = """CREATE TABLE "loot" (
    "id" INTEGER PRIMARY KEY,
    "first_scraped_date" TEXT,
    "last_scraped_date" TEXT,
    "source" TEXT,
    "type" TEXT,
    "rawtext" TEXT,
    "title" TEXT,
    "subtitle" TEXT,
    "publisher" TEXT,
    "valid_until" TEXT
);"""


class LootDatabase:
    def __init__(self, db_path: Path = None) -> None:
        path: Path
        if db_path is not None:
            path = Path(db_path / DB_NAME)
        else:
            path = Path(Path("data/") / DB_NAME)

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

    def create_tables(self) -> None:
        self.cursor.execute(DROP_LOOT_TABLE)
        self.cursor.execute(CREATE_LOOT_TABLE)

    def insert_offers(self, offers: list[LootOffer]) -> None:
        current_date = date.today().strftime(DATEFORMAT)
        for offer in offers:
            self.cursor.execute(
                """INSERT INTO loot(first_scraped_date, last_scraped_date, rawtext, source, type, title, subtitle, publisher, valid_until)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    current_date,
                    current_date,
                    offer.rawtext,
                    offer.source,
                    offer.type,
                    offer.title,
                    offer.subtitle,
                    offer.publisher,
                    offer.enddate,
                ),
            )

    def read_offers(self) -> list[LootOffer]:
        self.cursor.execute(
            "SELECT source, type, title, subtitle, publisher, valid_until FROM loot ORDER BY type"
        )
        offers = []

        for row in self.cursor:  # type: ignore
            offer = LootOffer(source=row[0], type=row[1], title=row[2], subtitle=row[3], publisher=row[4], enddate=row[5])  # type: ignore
            offers.append(offer)

        return offers

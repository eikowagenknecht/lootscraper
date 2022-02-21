from __future__ import annotations
import logging

import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import TracebackType
from typing import Any, Final, Type

from app.configparser import Config

from .common import TIMESTAMP_LONG, TIMESTAMP_SHORT, LootOffer

CURRENT_DB_VERSION = 0

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
        if self.get_version() == 0:
            logging.info("New database, initializing to v1")
            self.cursor.execute(CREATE_LOOT_TABLE)
            self.set_version(1)

        if self.get_version() == 1:
            logging.info("Updating database from v1 to v2")
            self.fix_date_format()
            self.set_version(2)

        if self.get_version() == 2:
            logging.info("Updating database from v2 to v3")
            self.fix_date_format()
            self.set_version(3)

    def fix_date_format(self) -> None:
        self.cursor.execute("SELECT id, seen_first FROM loot ORDER BY type")
        for row in self.cursor.fetchall():  # type: ignore
            self.fix_date(row, "seen_first")  # type: ignore

        self.cursor.execute("SELECT id, seen_last FROM loot ORDER BY type")
        for row in self.cursor.fetchall():  # type: ignore
            self.fix_date(row, "seen_last")  # type: ignore

        self.cursor.execute("SELECT id, valid_to FROM loot ORDER BY type")
        for row in self.cursor.fetchall():  # type: ignore
            self.fix_date(row, "valid_to")  # type: ignore

    def fix_date(self, row: Any, field: str) -> None:
        if not row[1]:  # type: ignore
            return

        fixed_date: datetime | None = None
        # Try to fix ISO timestamps (includes those without timezone info)
        try:
            fixed_date = datetime.fromisoformat(row[1]) if row[1] else None  # type: ignore
        except ValueError:
            pass

        # Try to fix short timestamps (only for valid_until, so add 1 day for correct end second)
        if fixed_date is None:
            try:
                fixed_date = datetime.strptime(row[1], TIMESTAMP_SHORT) if row[1] else None  # type: ignore
                fixed_date = fixed_date + timedelta(days=1) if fixed_date else None
            except ValueError:
                pass

        # Try to fix long timestamps
        if fixed_date is None:
            try:
                fixed_date = datetime.strptime(row[1], TIMESTAMP_LONG) if row[1] else None  # type: ignore
            except ValueError:
                pass

        if fixed_date is None:
            logging.error(
                f"Could not convert {field} for entry {row[0]}"  # type: ignore
            )
        else:
            # Rewrite the timestamp
            new_value: str = fixed_date.replace(tzinfo=timezone.utc).isoformat()
            if row[1] == new_value:
                return

            logging.info(
                f"Updating {field} for entry {row[0]} from {row[1]} to {new_value}"  # type: ignore
            )
            self.cursor.execute(
                f"UPDATE loot SET {field} = ? WHERE id = ?",  # nosec only 3 possible calls with fixed values
                (new_value, row[0]),  # type: ignore
            )

    def get_version(self) -> int:
        version: int = self.cursor.execute("PRAGMA user_version").fetchone()[0]  # type: ignore
        return version

    def set_version(self, version: int) -> None:
        self.cursor.execute("PRAGMA user_version = {v:d}".format(v=version))

    def touch_offer(self, db_offer: LootOffer) -> None:
        if db_offer.id is None:
            return

        self.cursor.execute(
            """UPDATE loot
                SET seen_last = ?
                WHERE id = ?""",
            (
                datetime.now().isoformat(),
                db_offer.id,
            ),
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
        current_date = datetime.now()
        self.cursor.execute(
            """INSERT INTO loot(seen_first, seen_last, rawtext, source, type, title, subtitle, publisher, valid_from, valid_to, url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                current_date.isoformat(),
                current_date.isoformat(),
                offer.rawtext,
                offer.source,
                offer.type,
                offer.title,
                offer.subtitle,
                offer.publisher,
                offer.valid_from.isoformat() if offer.valid_from else "",
                offer.valid_to.isoformat() if offer.valid_to else "",
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
                valid_from=datetime.fromisoformat(row[6]).replace(tzinfo=timezone.utc) if row[6] else None,  # type: ignore
                valid_to=datetime.fromisoformat(row[7]).replace(tzinfo=timezone.utc) if row[7] else None,  # type: ignore
                seen_first=datetime.fromisoformat(row[8]).replace(tzinfo=timezone.utc),  # type: ignore
                seen_last=datetime.fromisoformat(row[9]).replace(tzinfo=timezone.utc),  # type: ignore
                url=row[10],  # type: ignore
            )
            offers.append(offer)

        return offers

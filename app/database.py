from __future__ import annotations

import logging
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import TracebackType
from typing import Any, Type

from app.configparser import Config
from app.scraper.info.gameinfo import Gameinfo

from .common import TIMESTAMP_LONG, TIMESTAMP_SHORT, LootOffer, OfferType, Source

CURRENT_DB_VERSION = 0


class LootDatabase:
    def __init__(self) -> None:
        path = Config.data_path() / Path(Config.get().database_file)

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
            self.cursor.execute(
                """CREATE TABLE IF NOT EXISTS "loot" (
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
            )
            self.set_version(1)

        if self.get_version() == 1:
            logging.info("Updating database from v1 to v2")
            self.fix_date_format()
            self.set_version(2)

        if self.get_version() == 2:
            logging.info("Updating database from v2 to v3")
            self.fix_date_format()
            self.set_version(3)

        if self.get_version() == 3:
            logging.info("Updating database from v3 to v4")
            self.cursor.execute("ALTER TABLE loot ADD img_url TEXT")
            self.set_version(4)

        if self.get_version() == 4:
            logging.info("Updating database from v4 to v5")
            self.cursor.execute("ALTER TABLE loot ADD gameinfo TEXT")
            self.set_version(5)

    def fix_date_format(self) -> None:
        self.cursor.execute("SELECT id, seen_first FROM loot ORDER BY type")
        for row in self.cursor.fetchall():
            self.fix_date(row, "seen_first")

        self.cursor.execute("SELECT id, seen_last FROM loot ORDER BY type")
        for row in self.cursor.fetchall():
            self.fix_date(row, "seen_last")

        self.cursor.execute("SELECT id, valid_to FROM loot ORDER BY type")
        for row in self.cursor.fetchall():
            self.fix_date(row, "valid_to")

        self.cursor.execute("SELECT id, valid_from FROM loot ORDER BY type")
        for row in self.cursor.fetchall():
            self.fix_date(row, "valid_from")

    def fix_date(self, row: Any, field: str) -> None:
        if not row[1]:
            return

        fixed_date: datetime | None = None
        # Try to fix ISO timestamps (includes those without timezone info)
        try:
            fixed_date = datetime.fromisoformat(row[1]) if row[1] else None
        except ValueError:
            pass

        # Try to fix short timestamps (only for valid_until, so add 1 day for correct end second)
        if fixed_date is None:
            try:
                fixed_date = (
                    datetime.strptime(row[1], TIMESTAMP_SHORT) if row[1] else None
                )
                fixed_date = fixed_date + timedelta(days=1) if fixed_date else None
            except ValueError:
                pass

        # Try to fix long timestamps
        if fixed_date is None:
            try:
                fixed_date = (
                    datetime.strptime(row[1], TIMESTAMP_LONG) if row[1] else None
                )
            except ValueError:
                pass

        if fixed_date is None:
            logging.error(f"Could not convert {field} for entry {row[0]}")
        else:
            # Rewrite the timestamp
            new_value: str = fixed_date.replace(tzinfo=timezone.utc).isoformat()
            if row[1] == new_value:
                return

            logging.info(
                f"Updating {field} for entry {row[0]} from {row[1]} to {new_value}"
            )
            self.cursor.execute(
                f"UPDATE loot SET {field} = ? WHERE id = ?",  # nosec only 3 possible calls with fixed values
                (new_value, row[0]),
            )

    def get_version(self) -> int:
        version: int = self.cursor.execute("PRAGMA user_version").fetchone()[0]
        return version

    def set_version(self, version: int) -> None:
        self.cursor.execute("PRAGMA user_version = {v:d}".format(v=version))

    def touch_offer(self, offer: LootOffer) -> None:
        if offer.id is None:
            return

        self.cursor.execute(
            """UPDATE loot
                SET seen_last = ?
                WHERE id = ?""",
            (
                datetime.now().replace(tzinfo=timezone.utc).isoformat(),
                offer.id,
            ),
        )

    def update_offer(self, offer: LootOffer) -> None:
        if offer.id is None:
            return

        self.cursor.execute(
            """
                UPDATE loot SET
                    seen_last = ?,
                    rawtext = ?,
                    source = ?,
                    type = ?,
                    title = ?,
                    subtitle = ?,
                    publisher = ?,
                    valid_from = ?,
                    valid_to = ?,
                    url = ?,
                    img_url = ?,
                    gameinfo = ?
                WHERE id = ?
            """,
            (
                datetime.now().replace(tzinfo=timezone.utc).isoformat(),
                offer.rawtext or None,
                offer.source.value if offer.source else None,
                offer.type.value if offer.type else None,
                offer.title or None,
                offer.subtitle or None,
                offer.publisher or None,
                offer.valid_from.replace(tzinfo=timezone.utc).isoformat()
                if offer.valid_from
                else None,
                offer.valid_to.replace(tzinfo=timezone.utc).isoformat()
                if offer.valid_to
                else None,
                offer.url or None,
                offer.img_url or None,
                offer.gameinfo.to_json() if offer.gameinfo else None,
                offer.id,
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
        current_date = datetime.now().replace(tzinfo=timezone.utc).isoformat()

        self.cursor.execute(
            """
                INSERT INTO loot(
                    seen_first,
                    seen_last,
                    rawtext,
                    source,
                    type,
                    title,
                    subtitle,
                    publisher,
                    valid_from,
                    valid_to,
                    url,
                    img_url,
                    gameinfo
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                current_date,
                current_date,
                offer.rawtext or None,
                offer.source.value if offer.source else None,
                offer.type.value if offer.type else None,
                offer.title or None,
                offer.subtitle or None,
                offer.publisher or None,
                offer.valid_from.replace(tzinfo=timezone.utc).isoformat()
                if offer.valid_from
                else None,
                offer.valid_to.replace(tzinfo=timezone.utc).isoformat()
                if offer.valid_to
                else None,
                offer.url or None,
                offer.img_url or None,
                offer.gameinfo.to_json() if offer.gameinfo else None,
            ),
        )

    def find_offers(
        self,
        source: str | None,
        title: str | None,
        subtitle: str | None,
        valid_to: datetime | None,
    ) -> int:
        offers = self.cursor.execute(
            """
                SELECT id FROM loot WHERE
                source IS ? AND
                title IS ?  AND
                subtitle IS ? AND
                valid_to IS ?
            """,
            (
                source,
                title,
                subtitle,
                valid_to.replace(tzinfo=timezone.utc).isoformat() if valid_to else None,
            ),
        ).fetchall()

        if len(offers) == 0:
            return 0

        # Too many offers found, return the first one, but log an error
        if len(offers) >= 2:
            logging.error(
                f"Too many offers found for {source}, {title}, {subtitle}, {valid_to}"
            )

        # ID of the offer
        return offers[0][0]

    def read_offers(self) -> dict[str, dict[str, list[LootOffer]]]:
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
                ", img_url"
                ", gameinfo"
                " FROM loot"
                " ORDER BY type"
            )
        )
        offers: dict[str, dict[str, list[LootOffer]]] = {}

        for row in self.cursor:

            gameinfo: Gameinfo | None = Gameinfo.from_json(row[12]) if row[12] else None
            offer = LootOffer(
                id=row[0],
                source=Source(row[1]),
                type=OfferType(row[2]),
                title=row[3],
                subtitle=row[4],
                publisher=row[5],
                valid_from=datetime.fromisoformat(row[6]).replace(tzinfo=timezone.utc)
                if row[6]
                else None,
                valid_to=datetime.fromisoformat(row[7]).replace(tzinfo=timezone.utc)
                if row[7]
                else None,
                seen_first=datetime.fromisoformat(row[8]).replace(tzinfo=timezone.utc),
                seen_last=datetime.fromisoformat(row[9]).replace(tzinfo=timezone.utc),
                url=row[10],
                img_url=row[11],
                gameinfo=gameinfo,
            )

            source: str = Source(row[1]).name
            type: str = OfferType(row[2]).name
            if source not in offers:
                offers[source] = {}
            if type not in offers[source]:
                offers[source][type] = []

            offers[source][type].append(offer)

        return offers

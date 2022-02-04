import sqlite3
from typing import Final

from .common import LootOffer

DROP_LOOT_TABLE: Final = """DROP TABLE IF EXISTS loot"""
CREATE_LOOT_TABLE: Final = """CREATE TABLE "loot" (
    "first_scraped_date" TEXT,
    "last_scraped_date" TEXT,
    "source" TEXT,
    "type" TEXT,
    "title" TEXT,
    "subtitle" TEXT,
    "publisher" TEXT,
    "valid_until" TEXT
);"""


def prepare_database(docker: bool) -> sqlite3.Connection:
    dbfile = "/data/loot.db" if docker else "data/loot.db"
    db_connection = sqlite3.connect(dbfile)

    cur = db_connection.cursor()

    # Initialize database

    cur.execute(DROP_LOOT_TABLE)
    cur.execute(CREATE_LOOT_TABLE)

    return db_connection


def insert_offers(db_connection: sqlite3.Connection, offers: list[LootOffer]) -> None:
    # TODO: Check offers against those in the database
    # TODO: Only insert offers that are new (type+title+subtitle match)
    cursor = db_connection.cursor()

    for offer in offers:
        cursor.execute(
            "INSERT INTO loot VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                "1234-56-78",
                "1234-56-78",
                "source",
                offer.type,
                offer.title,
                offer.subtitle,
                offer.publisher,
                offer.enddate,
            ),
        )


def read_offers(db_connection: sqlite3.Connection) -> list[LootOffer]:
    cursor = db_connection.cursor()
    cursor.execute(
        "SELECT source, type, title, subtitle, publisher, valid_until FROM loot ORDER BY type"
    )
    rows = cursor.fetchall()

    offers = []
    for row in rows:
        offers.append(LootOffer(row[0], row[1], row[2], row[3], row[4], row[5]))

    return offers

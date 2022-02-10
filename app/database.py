import sqlite3
from typing import Final

from .common import LootOffer

DROP_LOOT_TABLE: Final = """DROP TABLE IF EXISTS loot"""
CREATE_LOOT_TABLE: Final = """CREATE TABLE "loot" (
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
            """INSERT INTO loot(first_scraped_date, last_scraped_date, rawtext, source, type, title, subtitle, publisher, valid_until)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                "1234-56-78",
                "1234-56-78",
                offer.rawtext,
                offer.source,
                offer.type,
                offer.title,
                offer.subtitle,
                offer.publisher,
                offer.enddate,
            ),
        )


def terminate_connection(db_connection: sqlite3.Connection) -> None:
    db_connection.commit()
    db_connection.close()


def read_offers(db_connection: sqlite3.Connection) -> list[LootOffer]:
    cursor = db_connection.cursor()
    cursor.execute(
        "SELECT source, type, title, subtitle, publisher, valid_until FROM loot ORDER BY type"
    )
    offers = []

    for row in cursor:  # type: ignore
        offer = LootOffer(source=row[0], type=row[1], title=row[2], subtitle=row[3], publisher=row[4], enddate=row[5])  # type: ignore
        offers.append(offer)

    return offers

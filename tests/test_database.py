# type: ignore
import logging
import unittest

from app.common import TIMESTAMP_LONG
from app.sqlalchemy import LootDatabase

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)-5s] %(message)s",
    datefmt=TIMESTAMP_LONG,
)


class DatabaseTests(unittest.TestCase):
    def test_entity_framework(self) -> None:
        with LootDatabase(echo=True) as db:
            db.initialize_or_update()


if __name__ == "__main__":
    unittest.main()

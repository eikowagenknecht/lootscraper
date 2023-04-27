import unittest

from lootscraper.database import LootDatabase


class DatabaseTests(unittest.TestCase):
    def test_entity_framework(self) -> None:
        with self.assertNoLogs(level="ERROR"), LootDatabase(echo=True) as db:
            db.initialize_or_update()


if __name__ == "__main__":
    unittest.main()

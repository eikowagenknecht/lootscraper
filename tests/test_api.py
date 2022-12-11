# type: ignore
import logging
import unittest

from app.common import TIMESTAMP_LONG
from app.scraper.info.igdb import get_igdb_details, get_igdb_id

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)-5s] %(message)s",
    datefmt=TIMESTAMP_LONG,
)


class ApiTests(unittest.IsolatedAsyncioTestCase):
    async def test_igdb_id(self) -> None:
        id_ = await get_igdb_id("Cities: Skylines")
        self.assertEqual(id_, 9066)

    async def test_igdb_id_resolution_with_special_chars(self) -> None:
        searchstring = "Monkey Island 2 Special Edition: LeChuck’s Revenge"
        expected_id: int = 66
        scraped_id: int = await get_igdb_id(searchstring)
        self.assertEqual(expected_id, scraped_id)

    async def test_igdb_details(self) -> None:
        game = await get_igdb_details(title="Cities: Skylines")
        self.assertEqual(game.name, "Cities: Skylines")
        self.assertIsNotNone(game.release_date)
        self.assertEqual(game.release_date.isoformat(), "2015-03-10T00:00:00+00:00")


if __name__ == "__main__":
    unittest.main()

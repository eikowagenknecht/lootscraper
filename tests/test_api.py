# type: ignore
import unittest

from app.scraper.info.igdb import get_igdb_details, get_igdb_id


class IGDBGameInfoTests(unittest.IsolatedAsyncioTestCase):
    async def test_igdb_id_resolution(self) -> None:
        expected_id: int = 7360  # Tom Clancy's Rainbow Six® Siege
        with self.assertNoLogs(level="ERROR"):
            scraped_id: int = await get_igdb_id(
                "Rainbow Six Siege",
            )
        self.assertEqual(expected_id, scraped_id)

    async def test_igdb_id_resolution_with_special_chars(self) -> None:
        expected_id: int = 66
        with self.assertNoLogs(level="ERROR"):
            scraped_id: int = await get_igdb_id(
                "Monkey Island 2 Special Edition: LeChuck’s Revenge",
            )
        self.assertEqual(expected_id, scraped_id)

    async def test_igdb_details_counterstrike(self) -> None:
        with self.assertNoLogs(level="ERROR"):
            igdb_info = await get_igdb_details(
                title="Counter-Strike",
            )
        self.assertIsNotNone(igdb_info)
        self.assertEqual(igdb_info.name, "Counter-Strike")
        self.assertIsNotNone(igdb_info.short_description)
        self.assertEqual(
            igdb_info.release_date.isoformat(), "2000-11-09T00:00:00+00:00"
        )
        self.assertGreater(igdb_info.meta_ratings, 1)
        self.assertGreater(igdb_info.meta_score, 50)

        self.assertGreater(igdb_info.user_ratings, 400)
        self.assertGreater(igdb_info.user_score, 50)
        self.assertEqual(igdb_info.url, "https://www.igdb.com/games/counter-strike")


if __name__ == "__main__":
    unittest.main()

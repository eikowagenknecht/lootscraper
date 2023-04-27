# type: ignore
import unittest

from lootscraper.browser import get_browser_context
from lootscraper.scraper.info.igdb import get_igdb_details, get_igdb_id
from lootscraper.scraper.info.steam import get_steam_details, get_steam_id


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
            igdb_info.release_date.isoformat(), "2000-11-09T00:00:00+00:00",
        )
        self.assertGreater(igdb_info.meta_ratings, 1)
        self.assertGreater(igdb_info.meta_score, 50)

        self.assertGreater(igdb_info.user_ratings, 400)
        self.assertGreater(igdb_info.user_score, 50)
        self.assertEqual(igdb_info.url, "https://www.igdb.com/games/counter-strike")


class SteamGameInfoTests(unittest.IsolatedAsyncioTestCase):
    async def test_steam_appid_resolution(self) -> None:
        async with get_browser_context() as context:
            expected_id: int = 359550  # Tom Clancy's Rainbow Six® Siege
            with self.assertNoLogs(level="ERROR"):
                scraped_id: int = await get_steam_id(
                    "Rainbow Six Siege",
                    context=context,
                )
            self.assertEqual(expected_id, scraped_id)

    async def test_steam_appid_no_match(self) -> None:
        async with get_browser_context() as context:
            expected_id = None  # Tom Clancy's Rainbow Six® Siege
            with self.assertNoLogs(level="ERROR"):
                scraped_id: int = await get_steam_id(
                    "XXXXXXXXXXXXXXXXXXXXXXXXXXXX",
                    context=context,
                )
            self.assertEqual(expected_id, scraped_id)

    async def test_steam_appid_resolution_with_special_chars(self) -> None:
        async with get_browser_context() as context:
            expected_id: int = 32460
            with self.assertNoLogs(level="ERROR"):
                scraped_id: int = await get_steam_id(
                    "Monkey Island 2 Special Edition: LeChuck’s Revenge",
                    context=context,
                )
            self.assertEqual(expected_id, scraped_id)

    async def test_steam_details_counterstrike(self) -> None:
        async with get_browser_context() as context:
            with self.assertNoLogs(level="ERROR"):
                steam_info = await get_steam_details(
                    title="Counter-Strike",
                    context=context,
                )
            self.assertIsNotNone(steam_info)
            self.assertEqual(steam_info.name, "Counter-Strike")
            self.assertIsNotNone(steam_info.short_description)
            self.assertEqual(
                steam_info.release_date.isoformat(), "2000-11-01T00:00:00+00:00",
            )
            self.assertEqual(steam_info.recommended_price_eur, 8.19)
            self.assertEqual(steam_info.genres, "Action")

            self.assertGreater(steam_info.recommendations, 100000)
            self.assertGreater(steam_info.percent, 90)
            self.assertEqual(steam_info.score, 10)
            self.assertEqual(steam_info.metacritic_score, 88)
            self.assertEqual(
                steam_info.metacritic_url,
                """https://www.metacritic.com/game/pc/counter-strike?ftag=MCD-06-10aaa1f""",
            )

    async def test_steam_details_rainbowsix(self) -> None:
        async with get_browser_context() as context:
            with self.assertNoLogs(level="ERROR"):
                steam_info = await get_steam_details(
                    title="Rainbow Six Siege",
                    context=context,
                )
            self.assertIsNotNone(steam_info)
            self.assertEqual(steam_info.name, "Tom Clancy's Rainbow Six® Siege")
            self.assertIsNotNone(steam_info.short_description)
            self.assertEqual(
                steam_info.release_date.isoformat(), "2015-12-01T00:00:00+00:00",
            )
            self.assertEqual(steam_info.recommended_price_eur, 19.99)
            self.assertEqual(steam_info.genres, "Action")

            self.assertGreater(steam_info.recommendations, 850000)
            self.assertEqual(steam_info.percent, 87)
            self.assertEqual(steam_info.score, 9)
            self.assertEqual(steam_info.metacritic_score, None)
            self.assertEqual(steam_info.metacritic_url, None)

    async def test_steam_release_date(self) -> None:
        async with get_browser_context() as context:
            with self.assertNoLogs(level="ERROR"):
                steam_info = await get_steam_details(
                    title="Riverbond",
                    context=context,
                )
            self.assertIsNotNone(steam_info)
            self.assertEqual(steam_info.name, "Riverbond")
            self.assertIsNotNone(steam_info.release_date)
            self.assertEqual(
                steam_info.release_date.isoformat(), "2019-06-09T00:00:00+00:00",
            )

    async def test_steam_recommendations(self) -> None:
        async with get_browser_context() as context:
            with self.assertNoLogs(level="ERROR"):
                steam_info = await get_steam_details(
                    title="Riverbond",
                    context=context,
                )
            self.assertIsNotNone(steam_info)
            self.assertEqual(steam_info.name, "Riverbond")
            self.assertIsNotNone(steam_info.recommendations)

    async def test_steam_no_rating(self) -> None:
        async with get_browser_context() as context:
            with self.assertNoLogs(level="ERROR"):
                steam_info = await get_steam_details(
                    title="Project Malice",
                    context=context,
                )
            self.assertIsNotNone(steam_info)
            self.assertEqual(steam_info.name, "Project Malice")
            self.assertIsNotNone(steam_info.recommendations)

    # This is a weird one where without the cc parameter the price had been
    # shown in "KWR" in the JSON, so the store page had to be used instead to
    # get the price in EUR. Hopefully not needed any more.
    async def test_steam_price_currency(self) -> None:
        async with get_browser_context() as context:
            with self.assertNoLogs(level="ERROR"):
                steam_info = await get_steam_details(
                    title="Cities: Skylines",
                    context=context,
                )
            self.assertIsNotNone(steam_info)
            self.assertEqual(steam_info.name, "Cities: Skylines")
            self.assertEqual(steam_info.recommended_price_eur, 27.99)

    async def test_steam_price_free(self) -> None:
        async with get_browser_context() as context:
            with self.assertNoLogs(level="ERROR"):
                steam_info = await get_steam_details(
                    title="World of Tanks",
                    context=context,
                )
            self.assertIsNotNone(steam_info)
            self.assertEqual(steam_info.name, "World of Tanks")
            self.assertEqual(steam_info.recommended_price_eur, 0)

    async def test_steam_price_none(self) -> None:
        async with get_browser_context() as context:
            with self.assertNoLogs(level="ERROR"):
                steam_info = await get_steam_details(
                    title="Grand Theft Auto V",
                    context=context,
                )
            self.assertIsNotNone(steam_info)
            self.assertEqual(steam_info.name, "Grand Theft Auto V")
            self.assertEqual(steam_info.recommended_price_eur, None)

    async def test_steam_price_weekend(self) -> None:
        # This game is free on the weekend, that changes the page layout
        # Obviously this test will not prove anything if the game currently is
        # not free on the weekend.
        async with get_browser_context() as context:
            with self.assertNoLogs(level="ERROR"):
                steam_info = await get_steam_details(
                    title="Call of Duty®: Modern Warfare® II",
                    context=context,
                )
            self.assertIsNotNone(steam_info)
            self.assertEqual(steam_info.name, "Call of Duty®: Modern Warfare® II")
            self.assertEqual(steam_info.recommended_price_eur, 69.99)

    async def test_steam_no_reviews(self) -> None:
        # Obviously this test will not prove anything if the game now has reviews
        async with get_browser_context() as context:
            with self.assertNoLogs(level="ERROR"):
                steam_info = await get_steam_details(
                    title="Candy Kombat",
                    context=context,
                )
            self.assertIsNotNone(steam_info)
            self.assertEqual(steam_info.name, "Candy Kombat")
            self.assertEqual(steam_info.percent, None)

    async def test_steam_price_ea_included(self) -> None:
        # This game is included with EA Play, that changes the page layout
        async with get_browser_context() as context:
            with self.assertNoLogs(level="ERROR"):
                steam_info = await get_steam_details(
                    title="Battlefield™ 2042",
                    context=context,
                )
            self.assertIsNotNone(steam_info)
            self.assertEqual(steam_info.name, "Battlefield™ 2042")
            self.assertEqual(steam_info.recommended_price_eur, 59.99)

    async def test_steam_language(self) -> None:
        async with get_browser_context() as context:
            with self.assertNoLogs(level="ERROR"):
                steam_info = await get_steam_details(
                    title="Warframe",
                    context=context,
                )
            self.assertIsNotNone(steam_info)
            self.assertEqual(steam_info.name, "Warframe")
            self.assertEqual(steam_info.short_description[0:6], "Awaken")

    async def test_steam_skip_age_check(self) -> None:
        async with get_browser_context() as context:
            with self.assertNoLogs(level="ERROR"):
                steam_info = await get_steam_details(
                    title="Doom Eternal",
                    context=context,
                )
            self.assertIsNotNone(steam_info)
            self.assertEqual(steam_info.name, "DOOM Eternal")
            self.assertEqual(
                steam_info.release_date.isoformat(), "2020-03-19T00:00:00+00:00",
            )

    async def test_steam_multiple_genres(self) -> None:
        async with get_browser_context() as context:
            with self.assertNoLogs(level="ERROR"):
                steam_info = await get_steam_details(
                    id_=1424910,
                    context=context,
                )
            self.assertIsNotNone(steam_info)
            self.assertEqual(steam_info.genres, "Action, Indie, Racing, Early Access")


if __name__ == "__main__":
    unittest.main()

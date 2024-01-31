# type: ignore
from __future__ import annotations

import unittest

from lootscraper.browser import get_browser_context
from lootscraper.scraper.info_igdb import get_igdb_details, get_igdb_id
from lootscraper.scraper.info_steam import get_steam_details, get_steam_id


class IGDBGameInfoTests(unittest.IsolatedAsyncioTestCase):
    async def test_igdb_id_resolution(self) -> None:
        expected_id: int = 7360  # Tom Clancy's Rainbow Six® Siege
        with self.assertNoLogs(level="ERROR"):
            scraped_id: int = await get_igdb_id(
                "Rainbow Six Siege",
            )
        assert expected_id == scraped_id

    async def test_igdb_id_resolution_with_special_chars(
        self,
    ) -> None:
        expected_id: int = 66
        with self.assertNoLogs(level="ERROR"):
            scraped_id: int = await get_igdb_id(
                "Monkey Island 2 Special Edition: LeChuck’s Revenge",  # noqa
            )
        assert expected_id == scraped_id

    async def test_igdb_details_counterstrike(self) -> None:
        with self.assertNoLogs(level="ERROR"):
            igdb_info = await get_igdb_details(
                title="Counter-Strike",
            )
        assert igdb_info is not None
        assert igdb_info.name == "Counter-Strike"
        assert igdb_info.short_description is not None
        assert igdb_info.release_date.isoformat() == "2000-11-09T00:00:00+00:00"
        assert igdb_info.meta_ratings > 1
        assert igdb_info.meta_score > 50

        assert igdb_info.user_ratings > 400
        assert igdb_info.user_score > 50
        assert igdb_info.url == "https://www.igdb.com/games/counter-strike"


class SteamGameInfoTests(unittest.IsolatedAsyncioTestCase):
    async def test_steam_appid_resolution_issue_310(self) -> None:
        async with get_browser_context() as context:
            expected_id: int = 269270  # LOVE
            with self.assertNoLogs(level="ERROR"):
                scraped_id: int = await get_steam_id(
                    "LOVE",
                    context=context,
                )
            assert expected_id == scraped_id

    async def test_steam_appid_resolution(self) -> None:
        async with get_browser_context() as context:
            expected_id: int = 359550  # Tom Clancy's Rainbow Six® Siege
            with self.assertNoLogs(level="ERROR"):
                scraped_id: int = await get_steam_id(
                    "Rainbow Six Siege",
                    context=context,
                )
            assert expected_id == scraped_id

    async def test_steam_appid_no_match(self) -> None:
        async with get_browser_context() as context:
            expected_id = None  # Tom Clancy's Rainbow Six® Siege
            with self.assertNoLogs(level="ERROR"):
                scraped_id: int = await get_steam_id(
                    "XXXXXXXXXXXXXXXXXXXXXXXXXXXX",
                    context=context,
                )
            assert expected_id == scraped_id

    async def test_steam_appid_resolution_with_special_chars(
        self,
    ) -> None:
        async with get_browser_context() as context:
            expected_id: int = 32460
            with self.assertNoLogs(level="ERROR"):
                scraped_id: int = await get_steam_id(
                    "Monkey Island 2 Special Edition: LeChuck’s Revenge",  # noqa
                    context=context,
                )
            assert expected_id == scraped_id

    async def test_steam_details_counterstrike(self) -> None:
        async with get_browser_context() as context:
            with self.assertNoLogs(level="ERROR"):
                steam_info = await get_steam_details(
                    title="Counter-Strike",
                    context=context,
                )
            assert steam_info is not None
            assert steam_info.name == "Counter-Strike"
            assert steam_info.short_description is not None
            assert steam_info.release_date.isoformat() == "2000-11-01T00:00:00+00:00"
            assert steam_info.recommended_price_eur == 8.19
            assert steam_info.genres == "Action"

            assert steam_info.recommendations > 100000
            assert steam_info.percent > 90
            assert steam_info.score == 10
            assert steam_info.metacritic_score == 88
            assert (
                steam_info.metacritic_url
                == "https://www.metacritic.com/game/pc/counter-strike?ftag=MCD-06-10aaa1f"
            )

    async def test_steam_details_rainbowsix(self) -> None:
        async with get_browser_context() as context:
            with self.assertNoLogs(level="ERROR"):
                steam_info = await get_steam_details(
                    title="Rainbow Six Siege",
                    context=context,
                )
            assert steam_info is not None
            assert steam_info.name == "Tom Clancy's Rainbow Six® Siege"
            assert steam_info.short_description is not None
            assert steam_info.release_date.isoformat() == "2015-12-01T00:00:00+00:00"
            assert steam_info.recommended_price_eur == 19.99
            assert steam_info.genres == "Action"

            assert steam_info.recommendations > 850000
            assert steam_info.percent > 80
            assert steam_info.score == 9
            assert steam_info.metacritic_score is None
            assert steam_info.metacritic_url is None

    async def test_steam_release_date(self) -> None:
        async with get_browser_context() as context:
            with self.assertNoLogs(level="ERROR"):
                steam_info = await get_steam_details(
                    title="Riverbond",
                    context=context,
                )
            assert steam_info is not None
            assert steam_info.name == "Riverbond"
            assert steam_info.release_date is not None
            assert steam_info.release_date.isoformat() == "2019-06-09T00:00:00+00:00"

    async def test_steam_recommendations(self) -> None:
        async with get_browser_context() as context:
            with self.assertNoLogs(level="ERROR"):
                steam_info = await get_steam_details(
                    title="Riverbond",
                    context=context,
                )
            assert steam_info is not None
            assert steam_info.name == "Riverbond"
            assert steam_info.recommendations is not None

    async def test_steam_no_rating(self) -> None:
        async with get_browser_context() as context:
            with self.assertNoLogs(level="ERROR"):
                steam_info = await get_steam_details(
                    title="Project Malice",
                    context=context,
                )
            assert steam_info is not None
            assert steam_info.name == "Project Malice"
            assert steam_info.recommendations is not None

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
            assert steam_info is not None
            assert steam_info.name == "Cities: Skylines"
            assert steam_info.recommended_price_eur == 27.99

    async def test_steam_price_free(self) -> None:
        async with get_browser_context() as context:
            with self.assertNoLogs(level="ERROR"):
                steam_info = await get_steam_details(
                    title="World of Tanks",
                    context=context,
                )
            assert steam_info is not None
            assert steam_info.name == "World of Tanks"
            assert steam_info.recommended_price_eur == 0

    async def test_steam_price_none(self) -> None:
        async with get_browser_context() as context:
            with self.assertNoLogs(level="ERROR"):
                steam_info = await get_steam_details(
                    title="Grand Theft Auto V",
                    context=context,
                )
            assert steam_info is not None
            assert steam_info.name == "Grand Theft Auto V"
            assert steam_info.recommended_price_eur is None

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
            assert steam_info is not None
            assert steam_info.name == "Call of Duty®: Modern Warfare® II"
            assert steam_info.recommended_price_eur == 69.99

    async def test_steam_no_reviews(self) -> None:
        # Obviously this test will not prove anything if the game now has reviews
        async with get_browser_context() as context:
            with self.assertNoLogs(level="ERROR"):
                steam_info = await get_steam_details(
                    title="Candy Kombat",
                    context=context,
                )
            assert steam_info is not None
            assert steam_info.name == "Candy Kombat"
            assert steam_info.percent is None

    async def test_steam_price_ea_included(self) -> None:
        # This game is included with EA Play, that changes the page layout
        async with get_browser_context() as context:
            with self.assertNoLogs(level="ERROR"):
                steam_info = await get_steam_details(
                    title="Battlefield™ 2042",
                    context=context,
                )
            assert steam_info is not None
            assert steam_info.name == "Battlefield™ 2042"
            assert steam_info.recommended_price_eur == 59.99

    async def test_steam_language(self) -> None:
        async with get_browser_context() as context:
            with self.assertNoLogs(level="ERROR"):
                steam_info = await get_steam_details(
                    title="Warframe",
                    context=context,
                )
            assert steam_info is not None
            assert steam_info.name == "Warframe"
            assert steam_info.short_description[0:6] == "Awaken"

    async def test_steam_skip_age_check(self) -> None:
        async with get_browser_context() as context:
            with self.assertNoLogs(level="ERROR"):
                steam_info = await get_steam_details(
                    title="Doom Eternal",
                    context=context,
                )
            assert steam_info is not None
            assert steam_info.name == "DOOM Eternal"
            assert steam_info.release_date.isoformat() == "2020-03-19T00:00:00+00:00"

    async def test_steam_multiple_genres(self) -> None:
        async with get_browser_context() as context:
            with self.assertNoLogs(level="ERROR"):
                steam_info = await get_steam_details(
                    id_=1424910,
                    context=context,
                )
            assert steam_info is not None
            assert steam_info.genres == "Action, Indie, Racing, Early Access"


if __name__ == "__main__":
    unittest.main()

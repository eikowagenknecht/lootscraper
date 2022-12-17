# type: ignore
import unittest
from datetime import datetime, timezone

from app.browser import get_browser_context
from app.scraper.info.steam import get_steam_details, get_steam_id
from app.scraper.loot.amazon_games import AmazonGamesScraper
from app.scraper.loot.amazon_loot import AmazonLootScraper
from app.scraper.loot.apple_games import AppleGamesScraper
from app.scraper.loot.epic_games import EpicGamesScraper
from app.scraper.loot.gog_games import GogGamesScraper
from app.scraper.loot.gog_games_alwaysfree import GogGamesAlwaysFreeScraper
from app.scraper.loot.google_games import GoogleGamesScraper
from app.scraper.loot.humble_games import HumbleGamesScraper
from app.scraper.loot.itch_games import ItchGamesScraper
from app.scraper.loot.steam_games import SteamGamesScraper
from app.scraper.loot.steam_loot import SteamLootScraper


class PlaywrightTests(unittest.IsolatedAsyncioTestCase):
    async def test_pagedriver(self) -> None:
        async with get_browser_context() as context:
            page = await context.new_page()
            res = await page.goto("https://google.com/")
            self.assertEqual(res.status, 200)


class AmazonGamesTests(unittest.IsolatedAsyncioTestCase):
    async def test_games(self) -> None:
        async with get_browser_context() as context:
            scraper = AmazonGamesScraper(context=context)
            with self.assertNoLogs(level="ERROR"):
                scraper_results = await scraper.scrape()
            self.assertNoLogs(level="ERROR")
            self.assertGreater(len(scraper_results), 0)
            for res in scraper_results:
                self.assertIsNotNone(res.title)
                self.assertIsNotNone(res.valid_to)
                self.assertIsNotNone(res.img_url)
                self.assertTrue(res.img_url.startswith("https://"))
                self.assertGreater(
                    res.valid_to, datetime.now().replace(tzinfo=timezone.utc)
                )


class AmazonLootTests(unittest.IsolatedAsyncioTestCase):
    async def test_loot(self) -> None:
        async with get_browser_context() as context:
            scraper = AmazonLootScraper(context=context)
            with self.assertNoLogs(level="ERROR"):
                scraper_results = await scraper.scrape()
            self.assertGreater(len(scraper_results), 0)
            for res in scraper_results:
                self.assertIsNotNone(res.probable_game_name)
                self.assertIsNotNone(res.title)
                self.assertIsNotNone(res.valid_to)
                if res.url is not None:
                    self.assertTrue(res.url.startswith("https://gaming.amazon.com"))
                self.assertIsNotNone(res.img_url)
                self.assertTrue(res.img_url.startswith("https://"))
                self.assertGreater(
                    res.valid_to, datetime.now().replace(tzinfo=timezone.utc)
                )


class AppleGamesTest(unittest.IsolatedAsyncioTestCase):
    async def test_loot(self) -> None:
        async with get_browser_context() as context:
            scraper = AppleGamesScraper(context=context)
            with self.assertNoLogs(level="ERROR"):
                scraper_results = await scraper.scrape()
            self.assertGreater(len(scraper_results), 0)
            for res in scraper_results:
                self.assertIsNotNone(res.probable_game_name)
                self.assertIsNotNone(res.title)
                self.assertIsNotNone(res.url)
                self.assertTrue(res.url.startswith("https://"))
                self.assertIsNotNone(res.img_url)
                self.assertTrue(res.img_url.startswith("https://"))


class EpicGamesTest(unittest.IsolatedAsyncioTestCase):
    async def test_loot(self) -> None:
        async with get_browser_context() as context:
            scraper = EpicGamesScraper(context=context)
            with self.assertNoLogs(level="ERROR"):
                scraper_results = await scraper.scrape()
            self.assertGreater(len(scraper_results), 0)
            for res in scraper_results:
                self.assertIsNotNone(res.valid_to)
                self.assertIsNotNone(res.title)
                self.assertIsNotNone(res.url)
                self.assertTrue(res.url.startswith("https://store.epicgames.com/"))
                self.assertIsNotNone(res.img_url)
                self.assertTrue(res.img_url.startswith("https://"))


class GogGamesFreeTest(unittest.IsolatedAsyncioTestCase):
    async def test_loot(self) -> None:
        async with get_browser_context() as context:
            scraper = GogGamesAlwaysFreeScraper(context=context)
            with self.assertNoLogs(level="ERROR"):
                scraper_results = await scraper.scrape()
            self.assertGreater(len(scraper_results), 40)
            for res in scraper_results:
                self.assertIsNotNone(res.title)
                self.assertIsNotNone(res.url)
                self.assertTrue(res.url.startswith("https://www.gog.com/"))
                self.assertIsNotNone(res.img_url)
                self.assertTrue(res.img_url.startswith("https://"))


class GogGamesTest(unittest.IsolatedAsyncioTestCase):
    async def test_loot(self) -> None:
        async with get_browser_context() as context:
            scraper = GogGamesScraper(context=context)
            with self.assertNoLogs(level="ERROR"):
                scraper_results = await scraper.scrape()
            self.assertGreater(len(scraper_results), 0)
            for res in scraper_results:
                self.assertIsNotNone(res.title)
                self.assertIsNotNone(res.url)
                self.assertTrue(res.url.startswith("https://www.gog.com/"))
                self.assertIsNotNone(res.img_url)
                self.assertTrue(res.img_url.startswith("https://"))
                # Some offer types do not contain a date
                if res.valid_to is not None:
                    self.assertGreater(
                        res.valid_to, datetime.now().replace(tzinfo=timezone.utc)
                    )


class GoogleGamesTest(unittest.IsolatedAsyncioTestCase):
    async def test_loot(self) -> None:
        async with get_browser_context() as context:
            scraper = GoogleGamesScraper(context=context)
            with self.assertNoLogs(level="ERROR"):
                scraper_results = await scraper.scrape()
            self.assertGreater(len(scraper_results), 0)
            for res in scraper_results:
                self.assertIsNotNone(res.title)
                self.assertIsNotNone(res.url)
                self.assertTrue(res.url.startswith("https://appagg.com/"))
                self.assertIsNotNone(res.img_url)
                self.assertTrue(res.img_url.startswith("https://"))


class HumbleGamesTest(unittest.IsolatedAsyncioTestCase):
    # TODO: Check if the demos are included and if they should be
    async def test_loot(self) -> None:
        async with get_browser_context() as context:
            scraper = HumbleGamesScraper(context=context)
            with self.assertNoLogs(level="ERROR"):
                scraper_results = await scraper.scrape()
            self.assertGreater(len(scraper_results), 0)
            for res in scraper_results:
                self.assertIsNotNone(res.title)
                self.assertIsNotNone(res.url)
                self.assertTrue(res.url.startswith("https://humblebundle.com/"))
                self.assertIsNotNone(res.img_url)
                self.assertTrue(res.img_url.startswith("https://"))


class ItchGamesTest(unittest.IsolatedAsyncioTestCase):
    async def test_loot(self) -> None:
        async with get_browser_context() as context:
            scraper = ItchGamesScraper(context=context)
            with self.assertNoLogs(level="ERROR"):
                scraper_results = await scraper.scrape()
            self.assertGreater(len(scraper_results), 0)
            for res in scraper_results:
                self.assertIsNotNone(res.title)
                self.assertIsNotNone(res.url)
                self.assertTrue(res.url.startswith("https://"))
                self.assertIsNotNone(res.img_url)
                self.assertTrue(res.img_url.startswith("https://"))


class SteamGamesTest(unittest.IsolatedAsyncioTestCase):
    # TODO: Run this again when games are available
    async def test_loot(self) -> None:
        async with get_browser_context() as context:
            scraper = SteamGamesScraper(context=context)
            with self.assertNoLogs(level="ERROR"):
                scraper_results = await scraper.scrape()
            self.assertGreater(len(scraper_results), 0)
            for res in scraper_results:
                self.assertIsNotNone(res.title)
                self.assertIsNotNone(res.url)
                self.assertTrue(res.url.startswith("https://store.steampowered.com/"))
                self.assertIsNotNone(res.img_url)
                self.assertTrue(res.img_url.startswith("https://"))
                self.assertGreater(
                    res.valid_to, datetime.now().replace(tzinfo=timezone.utc)
                )


class SteamLootTest(unittest.IsolatedAsyncioTestCase):
    async def test_loot(self) -> None:
        async with get_browser_context() as context:
            scraper = SteamLootScraper(context=context)
            with self.assertNoLogs(level="ERROR"):
                scraper_results = await scraper.scrape()
            self.assertGreater(len(scraper_results), 0)
            for res in scraper_results:
                self.assertIsNotNone(res.title)
                self.assertIsNotNone(res.url)
                self.assertTrue(res.url.startswith("https://store.steampowered.com/"))
                self.assertIsNotNone(res.img_url)
                self.assertTrue(res.img_url.startswith("https://"))
                self.assertGreater(
                    res.valid_to, datetime.now().replace(tzinfo=timezone.utc)
                )


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
                steam_info.release_date.isoformat(), "2000-11-01T00:00:00+00:00"
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
                steam_info.release_date.isoformat(), "2015-12-01T00:00:00+00:00"
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
                steam_info.release_date.isoformat(), "2019-06-09T00:00:00+00:00"
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
                steam_info.release_date.isoformat(), "2020-03-19T00:00:00+00:00"
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

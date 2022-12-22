# type: ignore
import unittest
from datetime import datetime, timezone

from lootscraper.browser import get_browser_context
from lootscraper.scraper.loot.amazon_games import AmazonGamesScraper
from lootscraper.scraper.loot.amazon_loot import AmazonLootScraper
from lootscraper.scraper.loot.apple_games import AppleGamesScraper
from lootscraper.scraper.loot.epic_games import EpicGamesScraper
from lootscraper.scraper.loot.gog_games import GogGamesScraper
from lootscraper.scraper.loot.gog_games_alwaysfree import GogGamesAlwaysFreeScraper
from lootscraper.scraper.loot.google_games import GoogleGamesScraper
from lootscraper.scraper.loot.humble_games import HumbleGamesScraper
from lootscraper.scraper.loot.itch_games import ItchGamesScraper
from lootscraper.scraper.loot.steam_games import SteamGamesScraper
from lootscraper.scraper.loot.steam_loot import SteamLootScraper


class PlaywrightTests(unittest.IsolatedAsyncioTestCase):
    async def test_pagedriver(self) -> None:
        async with get_browser_context() as context:
            page = await context.new_page()
            res = await page.goto("https://google.com/", timeout=30000)
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


if __name__ == "__main__":
    unittest.main()

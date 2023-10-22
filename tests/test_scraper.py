# type: ignore
from __future__ import annotations

import unittest
from datetime import datetime, timezone

from lootscraper.browser import get_browser_context
from lootscraper.scraper.amazon_games import AmazonGamesScraper
from lootscraper.scraper.amazon_loot import AmazonLootScraper
from lootscraper.scraper.apple_games import AppleGamesScraper
from lootscraper.scraper.epic_games import EpicGamesScraper
from lootscraper.scraper.gog_games import GogGamesScraper
from lootscraper.scraper.gog_games_alwaysfree import GogGamesAlwaysFreeScraper
from lootscraper.scraper.google_games import GoogleGamesScraper
from lootscraper.scraper.humble_games import HumbleGamesScraper
from lootscraper.scraper.itch_games import ItchGamesScraper
from lootscraper.scraper.steam_games import SteamGamesScraper
from lootscraper.scraper.steam_loot import SteamLootScraper
from lootscraper.scraper.ubisoft_games import UbisoftGamesScraper


class PlaywrightTests(unittest.IsolatedAsyncioTestCase):
    async def test_pagedriver(self) -> None:
        async with get_browser_context() as context:
            page = await context.new_page()
            res = await page.goto("https://google.com/", timeout=30000)
            assert res.status == 200


class AmazonGamesTests(unittest.IsolatedAsyncioTestCase):
    async def test_games(self) -> None:
        async with get_browser_context() as context:
            scraper = AmazonGamesScraper(context=context)
            with self.assertNoLogs(level="ERROR"):
                scraper_results = await scraper.scrape()
            self.assertNoLogs(level="ERROR")
            assert len(scraper_results) > 0
            for res in scraper_results:
                assert res.title is not None
                assert res.valid_to is not None
                assert res.img_url is not None
                assert res.img_url.startswith("https://")
                assert res.valid_to > datetime.now(tz=timezone.utc)


class AmazonLootTests(unittest.IsolatedAsyncioTestCase):
    async def test_loot(self) -> None:
        async with get_browser_context() as context:
            scraper = AmazonLootScraper(context=context)
            with self.assertNoLogs(level="ERROR"):
                scraper_results = await scraper.scrape()
            assert len(scraper_results) > 0
            for res in scraper_results:
                assert res.probable_game_name is not None
                assert res.title is not None
                assert res.valid_to is not None
                if res.url is not None:
                    assert res.url.startswith("https://gaming.amazon.com")
                assert res.img_url is not None
                assert res.img_url.startswith("https://")
                assert res.valid_to > datetime.now(tz=timezone.utc)


class AppleGamesTest(unittest.IsolatedAsyncioTestCase):
    async def test_loot(self) -> None:
        async with get_browser_context() as context:
            scraper = AppleGamesScraper(context=context)
            with self.assertNoLogs(level="ERROR"):
                scraper_results = await scraper.scrape()
            assert len(scraper_results) > 0
            for res in scraper_results:
                assert res.probable_game_name is not None
                assert res.title is not None
                assert res.url is not None
                assert res.url.startswith("https://")
                assert res.img_url is not None
                assert res.img_url.startswith("https://")


class EpicGamesTest(unittest.IsolatedAsyncioTestCase):
    async def test_loot(self) -> None:
        async with get_browser_context() as context:
            scraper = EpicGamesScraper(context=context)
            with self.assertNoLogs(level="ERROR"):
                scraper_results = await scraper.scrape()
            assert len(scraper_results) > 0
            for res in scraper_results:
                assert res.valid_to is not None
                assert res.title is not None
                assert res.url is not None
                assert res.url.startswith("https://store.epicgames.com/")
                assert res.img_url is not None
                assert res.img_url.startswith("https://")


class GogGamesFreeTest(unittest.IsolatedAsyncioTestCase):
    async def test_loot(self) -> None:
        async with get_browser_context() as context:
            scraper = GogGamesAlwaysFreeScraper(context=context)
            with self.assertNoLogs(level="ERROR"):
                scraper_results = await scraper.scrape()
            assert len(scraper_results) > 40
            for res in scraper_results:
                assert res.title is not None
                assert res.url is not None
                assert res.url.startswith("https://www.gog.com/")
                assert res.img_url is not None
                assert res.img_url.startswith("https://")


class GogGamesTest(unittest.IsolatedAsyncioTestCase):
    async def test_loot(self) -> None:
        async with get_browser_context() as context:
            scraper = GogGamesScraper(context=context)
            with self.assertNoLogs(level="ERROR"):
                scraper_results = await scraper.scrape()
            assert len(scraper_results) > 0
            for res in scraper_results:
                assert res.title is not None
                assert res.url is not None
                assert res.url.startswith("https://www.gog.com/")
                assert res.img_url is not None
                assert res.img_url.startswith("https://")
                # Some offer types do not contain a date
                if res.valid_to is not None:
                    assert res.valid_to > datetime.now(tz=timezone.utc)


class GoogleGamesTest(unittest.IsolatedAsyncioTestCase):
    async def test_loot(self) -> None:
        async with get_browser_context() as context:
            scraper = GoogleGamesScraper(context=context)
            with self.assertNoLogs(level="ERROR"):
                scraper_results = await scraper.scrape()
            assert len(scraper_results) > 0
            for res in scraper_results:
                assert res.title is not None
                assert res.url is not None
                assert res.url.startswith("https://appagg.com/")
                assert res.img_url is not None
                assert res.img_url.startswith("https://")


class HumbleGamesTest(unittest.IsolatedAsyncioTestCase):
    async def test_loot(self) -> None:
        async with get_browser_context() as context:
            scraper = HumbleGamesScraper(context=context)
            with self.assertNoLogs(level="ERROR"):
                scraper_results = await scraper.scrape()
            assert len(scraper_results) > 0
            for res in scraper_results:
                assert res.title is not None
                assert res.url is not None
                assert res.url.startswith("https://humblebundle.com/")
                assert res.img_url is not None
                assert res.img_url.startswith("https://")


class ItchGamesTest(unittest.IsolatedAsyncioTestCase):
    async def test_loot(self) -> None:
        async with get_browser_context() as context:
            scraper = ItchGamesScraper(context=context)
            with self.assertNoLogs(level="ERROR"):
                scraper_results = await scraper.scrape()
            assert len(scraper_results) > 0
            for res in scraper_results:
                assert res.title is not None
                assert res.url is not None
                assert res.url.startswith("https://")
                assert res.img_url is not None
                assert res.img_url.startswith("https://")


class SteamGamesTest(unittest.IsolatedAsyncioTestCase):
    async def test_loot(self) -> None:
        async with get_browser_context() as context:
            scraper = SteamGamesScraper(context=context)
            with self.assertNoLogs(level="ERROR"):
                scraper_results = await scraper.scrape()
            assert len(scraper_results) > 0
            for res in scraper_results:
                assert res.title is not None
                assert res.url is not None
                assert res.url.startswith("https://store.steampowered.com/")
                assert res.img_url is not None
                assert res.img_url.startswith("https://")
                assert res.valid_to > datetime.now(tz=timezone.utc)


class SteamLootTest(unittest.IsolatedAsyncioTestCase):
    async def test_loot(self) -> None:
        async with get_browser_context() as context:
            scraper = SteamLootScraper(context=context)
            with self.assertNoLogs(level="ERROR"):
                scraper_results = await scraper.scrape()
            assert len(scraper_results) > 0
            for res in scraper_results:
                assert res.title is not None
                assert res.url is not None
                assert res.url.startswith("https://store.steampowered.com/")
                assert res.img_url is not None
                assert res.img_url.startswith("https://")
                assert res.valid_to > datetime.now(tz=timezone.utc)


class UbisoftGamesTest(unittest.IsolatedAsyncioTestCase):
    async def test_loot(self) -> None:
        async with get_browser_context() as context:
            scraper = UbisoftGamesScraper(context=context)
            with self.assertNoLogs(level="ERROR"):
                scraper_results = await scraper.scrape()
            assert len(scraper_results) > 0
            for res in scraper_results:
                assert res.valid_to is not None
                assert res.title is not None
                assert res.url is not None
                assert res.url.startswith("https://store.ubi.com/")
                assert res.img_url is not None
                assert res.img_url.startswith("https://")


if __name__ == "__main__":
    unittest.main()

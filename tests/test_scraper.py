# type: ignore
import logging
import unittest

from app.common import TIMESTAMP_LONG
from app.pagedriver import get_browser_context
from app.scraper.info.steam import get_steam_details, get_steam_id
from app.scraper.loot.amazon_games import AmazonGamesScraper
from app.scraper.loot.amazon_loot import AmazonLootScraper
from app.scraper.loot.apple_games import AppleGamesScraper
from app.scraper.loot.epic_games import EpicGamesScraper

# from app.scraper.loot.gog_games import GogGamesScraper
from app.scraper.loot.gog_games_alwaysfree import GogGamesAlwaysFreeScraper

# from app.scraper.loot.steam_games import SteamGamesScraper
# from app.scraper.loot.steam_loot import SteamLootScraper

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)-5s] %(message)s",
    datefmt=TIMESTAMP_LONG,
)


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
            scraper_results = await scraper.scrape()
            self.assertGreater(len(scraper_results), 0)
            for res in scraper_results:
                self.assertIsNotNone(res.title)
                self.assertIsNotNone(res.valid_to)
                self.assertIsNotNone(res.img_url)


class AmazonLootTests(unittest.IsolatedAsyncioTestCase):
    async def test_loot(self) -> None:
        async with get_browser_context() as context:
            scraper = AmazonLootScraper(context=context)
            scraper_results = await scraper.scrape()
            self.assertGreater(len(scraper_results), 0)
            for res in scraper_results:
                self.assertIsNotNone(res.probable_game_name)
                self.assertIsNotNone(res.title)
                self.assertIsNotNone(res.valid_to)
                self.assertIsNotNone(res.img_url)


class AppleGamesTest(unittest.IsolatedAsyncioTestCase):
    async def test_loot(self) -> None:
        async with get_browser_context() as context:
            scraper = AppleGamesScraper(context=context)
            scraper_results = await scraper.scrape()
            self.assertGreater(len(scraper_results), 0)
            for res in scraper_results:
                self.assertIsNotNone(res.probable_game_name)
                self.assertIsNotNone(res.title)
                self.assertIsNotNone(res.url)
                self.assertIsNotNone(res.img_url)


class EpicGamesTest(unittest.IsolatedAsyncioTestCase):
    async def test_loot(self) -> None:
        async with get_browser_context() as context:
            scraper = EpicGamesScraper(context=context)
            scraper_results = await scraper.scrape()
            self.assertGreater(len(scraper_results), 0)
            for res in scraper_results:
                self.assertIsNotNone(res.valid_to)
                self.assertIsNotNone(res.title)
                self.assertIsNotNone(res.url)
                self.assertIsNotNone(res.img_url)
                self.assertFalse(res.img_url.startswith("data"))


class GogGamesFreeTest(unittest.IsolatedAsyncioTestCase):
    async def test_loot(self) -> None:
        async with get_browser_context() as context:
            scraper = GogGamesAlwaysFreeScraper(context=context)
            scraper_results = await scraper.scrape()
            self.assertGreater(len(scraper_results), 0)
            for res in scraper_results:
                self.assertIsNotNone(res.title)
                self.assertIsNotNone(res.url)
                self.assertIsNotNone(res.img_url)


class SteamGameInfoTests(unittest.IsolatedAsyncioTestCase):
    async def test_steam_appid_resolution(self) -> None:
        async with get_browser_context() as context:
            expected_id: int = 359550  # Tom Clancy's Rainbow Six® Siege
            scraped_id: int = await get_steam_id(
                "Rainbow Six Siege",
                context=context,
            )
            self.assertEqual(expected_id, scraped_id)

    async def test_steam_appid_resolution_with_special_chars(self) -> None:
        async with get_browser_context() as context:
            expected_id: int = 32460
            scraped_id: int = await get_steam_id(
                "Monkey Island 2 Special Edition: LeChuck’s Revenge",
                context=context,
            )
            self.assertEqual(expected_id, scraped_id)

    async def test_steam_details_counterstrike(self) -> None:
        async with get_browser_context() as context:
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

    async def test_steam_appinfo_releasedate(self) -> None:
        async with get_browser_context() as context:
            steam_info = await get_steam_details(title="Riverbond", context=context)
            self.assertIsNotNone(steam_info)
            self.assertEqual(steam_info.name, "Riverbond")
            self.assertIsNotNone(steam_info.release_date)
            self.assertEqual(
                steam_info.release_date.isoformat(), "2019-06-09T00:00:00+00:00"
            )

    async def test_steam_appinfo_recommendations(self) -> None:
        async with get_browser_context() as context:
            steam_info = await get_steam_details(title="Riverbond", context=context)
            self.assertIsNotNone(steam_info)
            self.assertEqual(steam_info.name, "Riverbond")
            self.assertIsNotNone(steam_info.recommendations)

    # This is a weird one where the price is shown in "KWR" in the JSON, so the
    # store page has to be used instead to get the price in EUR
    async def test_steam_appinfo_price(self) -> None:
        async with get_browser_context() as context:
            steam_info = await get_steam_details(
                title="Cities: Skylines", context=context
            )
            self.assertIsNotNone(steam_info)
            self.assertEqual(steam_info.name, "Cities: Skylines")
            self.assertEqual(steam_info.recommended_price_eur, 27.99)

    async def test_steam_appinfo_language(self) -> None:
        async with get_browser_context() as context:
            steam_info = await get_steam_details(title="Warframe", context=context)
            self.assertIsNotNone(steam_info)
            self.assertEqual(steam_info.name, "Warframe")
            self.assertEqual(steam_info.short_description[0:6], "Awaken")

    async def test_steam_appinfo_ageverify(self) -> None:
        async with get_browser_context() as context:
            steam_info = await get_steam_details(title="Doom Eternal", context=context)
            self.assertIsNotNone(steam_info)
            self.assertEqual(steam_info.name, "DOOM Eternal")
            self.assertEqual(
                steam_info.release_date.isoformat(), "2020-03-19T00:00:00+00:00"
            )

    async def test_steam_json_multiple_genres(self) -> None:
        async with get_browser_context() as context:
            steam_info = await get_steam_details(id_=1424910, context=context)
            self.assertIsNotNone(steam_info)
            self.assertEqual(steam_info.genres, "Action, Indie, Racing, Early Access")


if __name__ == "__main__":
    unittest.main()

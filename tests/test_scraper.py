# type: ignore
import logging
import unittest

from app.common import TIMESTAMP_LONG
from app.pagedriver import get_pagedriver
from app.scraper.info.steam import get_steam_details, get_steam_id

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)-5s] %(message)s",
    datefmt=TIMESTAMP_LONG,
)


class ScraperTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.driver = get_pagedriver()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.driver.quit()

    def test_pagedriver(self) -> None:
        self.assertIsNotNone(self.driver)


class AsyncScraperTests(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.driver = get_pagedriver()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.driver.quit()

    async def test_steam_appid_resolution(self) -> None:
        expected_id: int = 359550  # Tom Clancy's Rainbow Six® Siege
        scraped_id: int = await get_steam_id("Rainbow Six Siege", driver=self.driver)
        self.assertEqual(expected_id, scraped_id)

    async def test_steam_appid_resolution_with_special_chars(self) -> None:
        expected_id: int = 32460
        scraped_id: int = await get_steam_id(
            "Monkey Island 2 Special Edition: LeChuck’s Revenge", driver=self.driver
        )
        self.assertEqual(expected_id, scraped_id)

    async def test_steam_appinfo(self) -> None:
        steam_info = await get_steam_details(self.driver, title="Counter-Strike")
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

    async def test_steam_appinfo2(self) -> None:
        steam_info = await get_steam_details(
            title="Rainbow Six Siege", driver=self.driver
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
        steam_info = await get_steam_details(title="Riverbond", driver=self.driver)
        self.assertIsNotNone(steam_info)
        self.assertEqual(steam_info.name, "Riverbond")
        self.assertIsNotNone(steam_info.release_date)
        self.assertEqual(
            steam_info.release_date.isoformat(), "2019-06-09T00:00:00+00:00"
        )

    async def test_steam_appinfo_recommendations(self) -> None:
        steam_info = await get_steam_details(title="Riverbond", driver=self.driver)
        self.assertIsNotNone(steam_info)
        self.assertEqual(steam_info.name, "Riverbond")
        self.assertIsNotNone(steam_info.recommendations)

    # This is a weird one where the price is shown in "KWR" in the JSON, so the
    # store page has to be used instead to get the price in EUR
    async def test_steam_appinfo_price(self) -> None:
        steam_info = await get_steam_details(
            title="Cities: Skylines", driver=self.driver
        )
        self.assertIsNotNone(steam_info)
        self.assertEqual(steam_info.name, "Cities: Skylines")
        self.assertEqual(steam_info.recommended_price_eur, 27.99)

    async def test_steam_appinfo_language(self) -> None:
        steam_info = await get_steam_details(title="Warframe", driver=self.driver)
        self.assertIsNotNone(steam_info)
        self.assertEqual(steam_info.name, "Warframe")
        self.assertEqual(steam_info.short_description[0:6], "Awaken")

    async def test_steam_appinfo_ageverify(self) -> None:
        steam_info = await get_steam_details(title="Doom Eternal", driver=self.driver)
        self.assertIsNotNone(steam_info)
        self.assertEqual(steam_info.name, "DOOM Eternal")
        self.assertEqual(
            steam_info.release_date.isoformat(), "2020-03-19T00:00:00+00:00"
        )

    async def test_steam_json_multiple_genres(self) -> None:
        steam_info = await get_steam_details(id_=1424910, driver=self.driver)
        self.assertIsNotNone(steam_info)
        self.assertEqual(steam_info.genres, "Action, Indie, Racing, Early Access")


if __name__ == "__main__":
    unittest.main()

# type: ignore
import logging
import unittest
from time import sleep

from selenium.webdriver.chrome.webdriver import WebDriver

from app.common import TIMESTAMP_LONG
from app.configparser import Config
from app.pagedriver import get_pagedriver
from app.scraper.info.gameinfo import Gameinfo
from app.scraper.info.igdb import add_igdb_details, get_possible_igdb_id
from app.scraper.info.steam import add_steam_details, get_possible_steam_appid
from app.scraper.info.utils import get_match_score
from app.sqlalchemy import LootDatabase
from app.telegram import TelegramBot

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)-5s] %(message)s",
    datefmt=TIMESTAMP_LONG,
)


class VariousTests(unittest.TestCase):
    def test_entity_framework(self) -> None:
        with LootDatabase() as db:
            db.initialize_or_update()
            res = db.read_all()
            print(res)
        pass

    def test_telegram(self) -> None:
        # Arrange
        bot = TelegramBot(Config.get())
        # Act
        bot.start()
        sleep(1)
        bot.stop()
        # Assert
        self.assertEqual(1, 1)

    def test_similarity(self) -> None:
        search = "Rainbow Six Siege"
        result = "Tom Clancy's Rainbow Six® Siege"

        score = get_match_score(search, result)
        self.assertEquals(score, 0.99)

        search = "Fall Guys"
        result = "Fall Guy"

        score = get_match_score(search, result)
        self.assertLess(score, 0.99)

    def test_pagedriver(self) -> None:
        driver = get_pagedriver()
        self.assertIsNotNone(driver)

    def test_steam_appid_resolution(self) -> None:
        driver: WebDriver
        with get_pagedriver() as driver:
            expected_id: int = 359550  # Tom Clancy's Rainbow Six® Siege
            scraped_id: int = get_possible_steam_appid(driver, "Rainbow Six Siege")
            self.assertEquals(expected_id, scraped_id)

    def test_steam_appinfo(self) -> None:
        driver: WebDriver
        with get_pagedriver() as driver:
            game: Gameinfo | None = add_steam_details(driver, "Counter-Strike")
            self.assertIsNotNone(game)
            self.assertEquals(game.name, "Counter-Strike")
            self.assertIsNotNone(game.short_description)
            self.assertEquals(
                game.release_date.isoformat(), "2000-11-01T00:00:00+00:00"
            )
            self.assertEquals(game.recommended_price_eur, 8.19)
            self.assertEquals(game.genres[0], "Action")

            self.assertGreater(game.steam_recommendations, 100000)
            self.assertEquals(game.steam_percent, 96)
            self.assertEquals(game.steam_score, 10)
            self.assertEquals(game.metacritic_score, 88)
            self.assertEquals(
                game.metacritic_url,
                """https://www.metacritic.com/game/pc/counter-strike?ftag=MCD-06-10aaa1f""",
            )

    def test_steam_appinfo2(self) -> None:
        driver: WebDriver
        with get_pagedriver() as driver:
            game = add_steam_details(driver, "Rainbow Six Siege")
            self.assertIsNotNone(game)
            self.assertEquals(game.name, "Tom Clancy's Rainbow Six® Siege")
            self.assertIsNotNone(game.short_description)
            self.assertEquals(
                game.release_date.isoformat(), "2015-12-01T00:00:00+00:00"
            )
            self.assertEquals(game.recommended_price_eur, 19.99)
            self.assertEquals(game.genres[0], "Action")

            self.assertGreater(game.steam_recommendations, 850000)
            self.assertEquals(game.steam_percent, 87)
            self.assertEquals(game.steam_score, 9)
            self.assertEquals(game.metacritic_score, None)
            self.assertEquals(game.metacritic_url, None)

    # This is a weird one where the price is shown in "KWR" in the JSON, so the
    # store page has to be used instead to get the price in EUR
    def test_steam_appinfo_price(self) -> None:
        driver: WebDriver
        with get_pagedriver() as driver:
            game = add_steam_details(driver, "Cities: Skylines")
            self.assertIsNotNone(game)
            self.assertEquals(game.name, "Cities: Skylines")
            self.assertEquals(game.recommended_price_eur, 27.99)

    def test_steam_appinfo_ageverify(self) -> None:
        driver: WebDriver
        with get_pagedriver() as driver:
            game = add_steam_details(driver, "Doom Eternal")
            self.assertIsNotNone(game)
            self.assertEquals(game.name, "DOOM Eternal")
            self.assertEquals(game.steam_score, 9)

    def test_steam_json_multiple_genres(self) -> None:
        with get_pagedriver() as driver:
            game = add_steam_details(driver, 1424910)
            self.assertIsNotNone(game)
            self.assertEquals(len(game.genres), 4)
            self.assertEquals(game.genres[0], "Action")

    def test_igdb_id(self) -> None:
        id = get_possible_igdb_id("Cities: Skylines")
        self.assertEquals(id, 9066)

    def test_igdb_details(self) -> None:
        game = add_igdb_details("Cities: Skylines")
        self.assertEquals(game.name, "Cities: Skylines")
        self.assertIsNotNone(game.release_date)
        self.assertEquals(game.release_date.isoformat(), "2015-03-10T00:00:00+00:00")


if __name__ == "__main__":
    unittest.main()

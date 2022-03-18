import unittest

from app.gameinfo import Gameinfo, get_possible_steam_appid, get_steam_info
from app.pagedriver import get_pagedriver


class TestUtils(unittest.TestCase):
    def test_pagedriver(self) -> None:
        driver = get_pagedriver()
        self.assertIsNotNone(driver)

    def test_steam_appid_resolution(self) -> None:
        expected_id: int = 359550
        scraped_id: int = get_possible_steam_appid("Rainbow Six Siege")
        self.assertEquals(expected_id, scraped_id)

    def test_steam_appinfo(self) -> None:
        gameinfo: Gameinfo = get_steam_info(10)
        self.assertEquals(gameinfo.name, "Counter-Strike")
        self.assertIsNotNone(gameinfo.short_description)
        self.assertEquals(gameinfo.release_date, "1 Nov, 2000")
        self.assertEquals(gameinfo.recommended_price, "8.19 EUR")
        self.assertEquals(gameinfo.genre, "Action")

        self.assertGreater(gameinfo.recommendations, 100000)
        self.assertEquals(gameinfo.rating_percent, 96)
        self.assertEquals(gameinfo.rating_score, 10)
        self.assertEquals(gameinfo.metacritic_score, 88)
        self.assertEquals(
            gameinfo.metacritic_url,
            """https://www.metacritic.com/game/pc/counter-strike?ftag=MCD-06-10aaa1f""",
        )

    def test_steam_appinfo2(self) -> None:
        gameinfo = get_steam_info(359550)
        self.assertEquals(gameinfo.name, "Tom Clancy's Rainbow Six® Siege")
        self.assertIsNotNone(gameinfo.short_description)
        self.assertEquals(gameinfo.release_date, "1 Dec, 2015")
        self.assertEquals(gameinfo.recommended_price, "19.99 EUR")
        self.assertEquals(gameinfo.genre, "Action")

        self.assertGreater(gameinfo.recommendations, 850000)
        self.assertEquals(gameinfo.rating_percent, 87)
        self.assertEquals(gameinfo.rating_score, 9)
        self.assertEquals(gameinfo.metacritic_score, None)
        self.assertEquals(gameinfo.metacritic_url, None)


if __name__ == "__main__":
    unittest.main()

# type: ignore
import difflib
import unittest

from selenium.webdriver.chrome.webdriver import WebDriver

from app.pagedriver import get_pagedriver
from app.scraper.info.gameinfo import Gameinfo
from app.scraper.info.igdb import get_igdb_details, get_possible_igdb_id
from app.scraper.info.steam import get_possible_steam_appid, get_steam_details


class TestUtils(unittest.TestCase):
    def test_similarity(self) -> None:
        result = "Tom Clancy's Rainbow Six® Siege"
        searchstring = "Rainbow Six Siege"

        words_result = result.split(" ")
        words_searchstring = searchstring.split(" ")

        score = difflib.SequenceMatcher(
            a=searchstring.lower(), b=result.lower()
        ).ratio()
        threshold = 0.85

        if score < threshold and len(words_result) != len(words_searchstring):
            score = max(
                score,
                difflib.SequenceMatcher(
                    a=searchstring.lower(),
                    b=" ".join(words_result[: len(words_searchstring)]).lower(),
                ).ratio(),
            )
            score = max(
                score,
                difflib.SequenceMatcher(
                    a=searchstring.lower(),
                    b=" ".join(words_result[-len(words_searchstring) :]).lower(),
                ).ratio(),
            )

        self.assertGreater(score, 0.97)

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
            gameinfo: Gameinfo | None = get_steam_details(driver, "Counter-Strike")
            self.assertIsNotNone(gameinfo)
            self.assertEquals(gameinfo.name, "Counter-Strike")
            self.assertIsNotNone(gameinfo.short_description)
            self.assertEquals(
                gameinfo.release_date.isoformat(), "2000-11-01T00:00:00+00:00"
            )
            self.assertEquals(gameinfo.recommended_price_eur, 8.19)
            self.assertEquals(gameinfo.genres[0], "Action")

            self.assertGreater(gameinfo.steam_recommendations, 100000)
            self.assertEquals(gameinfo.steam_percent, 96)
            self.assertEquals(gameinfo.steam_score, 10)
            self.assertEquals(gameinfo.metacritic_score, 88)
            self.assertEquals(
                gameinfo.metacritic_url,
                """https://www.metacritic.com/game/pc/counter-strike?ftag=MCD-06-10aaa1f""",
            )

    def test_steam_appinfo2(self) -> None:
        driver: WebDriver
        with get_pagedriver() as driver:
            gameinfo = get_steam_details(driver, "Rainbow Six Siege")
            self.assertIsNotNone(gameinfo)
            self.assertEquals(gameinfo.name, "Tom Clancy's Rainbow Six® Siege")
            self.assertIsNotNone(gameinfo.short_description)
            self.assertEquals(
                gameinfo.release_date.isoformat(), "2015-12-01T00:00:00+00:00"
            )
            self.assertEquals(gameinfo.recommended_price_eur, 19.99)
            self.assertEquals(gameinfo.genres[0], "Action")

            self.assertGreater(gameinfo.steam_recommendations, 850000)
            self.assertEquals(gameinfo.steam_percent, 87)
            self.assertEquals(gameinfo.steam_score, 9)
            self.assertEquals(gameinfo.metacritic_score, None)
            self.assertEquals(gameinfo.metacritic_url, None)

    # This is a weird one where the price is shown in "KWR" in the JSON, so the
    # store page has to be used instead to get the price in EUR
    def test_steam_appinfo_price(self) -> None:
        driver: WebDriver
        with get_pagedriver() as driver:
            gameinfo = get_steam_details(driver, "Cities: Skylines")
            self.assertIsNotNone(gameinfo)
            self.assertEquals(gameinfo.name, "Cities: Skylines")
            self.assertEquals(gameinfo.recommended_price_eur, 27.99)

    def test_steam_appinfo_ageverify(self) -> None:
        driver: WebDriver
        with get_pagedriver() as driver:
            gameinfo = get_steam_details(driver, "Doom Eternal")
            self.assertIsNotNone(gameinfo)
            self.assertEquals(gameinfo.name, "DOOM Eternal")
            self.assertEquals(gameinfo.steam_score, 9)

    def test_steam_json_multiple_genres(self) -> None:
        with get_pagedriver() as driver:
            gameinfo = get_steam_details(driver, 1424910)
            self.assertIsNotNone(gameinfo)
            self.assertEquals(len(gameinfo.genres), 4)
            self.assertEquals(gameinfo.genres[0], "Action")

    def test_igdb_id(self) -> None:
        id = get_possible_igdb_id("Cities: Skylines")
        self.assertEquals(id, 9066)

    def test_igdb_details(self) -> None:
        gameinfo: Gameinfo = get_igdb_details("Cities: Skylines")
        self.assertEquals(gameinfo.name, "Cities: Skylines")
        self.assertEquals(
            gameinfo.release_date.isoformat(), "2015-03-10T00:00:00+00:00"
        )

    def test_merge(self) -> None:
        gameinfo_a: Gameinfo = Gameinfo()
        gameinfo_a.name = "A"
        gameinfo_a.steam_score = 1
        gameinfo_b: Gameinfo = Gameinfo()
        gameinfo_b.name = "B"
        gameinfo_b.igdb_meta_ratings = 2

        gameinfo_merged = Gameinfo.merge(gameinfo_a, gameinfo_b)
        self.assertEquals(gameinfo_merged.name, "A")
        self.assertEquals(gameinfo_merged.steam_score, 1)
        self.assertEquals(gameinfo_merged.igdb_meta_ratings, 2)

        pass


if __name__ == "__main__":
    unittest.main()

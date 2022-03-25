# type: ignore
import unittest
import difflib
from selenium.webdriver.chrome.webdriver import WebDriver

from app.gameinfo import Gameinfo, get_possible_steam_appid, get_steam_info
from app.pagedriver import get_pagedriver


class TestUtils(unittest.TestCase):
    def test_similarity(self) -> None:
        result = "Tom Clancy's Rainbow Six® Siege"
        searchstring = "Rainbow Six Siege"

        words_result = result.split(" ")
        words_searchstring = searchstring.split(" ")

        score = difflib.SequenceMatcher(
            a=searchstring.lower(), b=result.lower()
        ).ratio()
        threshold = 0.8

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
            gameinfo: Gameinfo | None = get_steam_info(driver, "Counter-Strike")
            self.assertIsNotNone(gameinfo)
            self.assertEquals(gameinfo.name, "Counter-Strike")
            self.assertIsNotNone(gameinfo.short_description)
            self.assertEquals(gameinfo.release_date, "1 Nov, 2000")
            self.assertEquals(gameinfo.recommended_price, "8.19 EUR")
            self.assertEquals(gameinfo.genres[0], "Action")

            self.assertGreater(gameinfo.recommendations, 100000)
            self.assertEquals(gameinfo.rating_percent, 96)
            self.assertEquals(gameinfo.rating_score, 10)
            self.assertEquals(gameinfo.metacritic_score, 88)
            self.assertEquals(
                gameinfo.metacritic_url,
                """https://www.metacritic.com/game/pc/counter-strike?ftag=MCD-06-10aaa1f""",
            )

    def test_steam_appinfo2(self) -> None:
        driver: WebDriver
        with get_pagedriver() as driver:
            gameinfo = get_steam_info(driver, "Rainbow Six Siege")
            self.assertIsNotNone(gameinfo)
            self.assertEquals(gameinfo.name, "Tom Clancy's Rainbow Six® Siege")
            self.assertIsNotNone(gameinfo.short_description)
            self.assertEquals(gameinfo.release_date, "1 Dec, 2015")
            self.assertEquals(gameinfo.recommended_price, "19.99 EUR")
            self.assertEquals(gameinfo.genres[0], "Action")

            self.assertGreater(gameinfo.recommendations, 850000)
            self.assertEquals(gameinfo.rating_percent, 87)
            self.assertEquals(gameinfo.rating_score, 9)
            self.assertEquals(gameinfo.metacritic_score, None)
            self.assertEquals(gameinfo.metacritic_url, None)

    # This is a weird one where the price is shown in "KWR" in the JSON, so the
    # store page has to be used instead to get the price in EUR
    def test_steam_appinfo_price(self) -> None:
        driver: WebDriver
        with get_pagedriver() as driver:
            gameinfo = get_steam_info(driver, "Cities: Skylines")
            self.assertIsNotNone(gameinfo)
            self.assertEquals(gameinfo.name, "Cities: Skylines")
            self.assertEquals(gameinfo.recommended_price, "27.99 EUR")

    def test_steam_appinfo_ageverify(self) -> None:
        driver: WebDriver
        with get_pagedriver() as driver:
            gameinfo = get_steam_info(driver, "Doom Eternal")
            self.assertIsNotNone(gameinfo)
            self.assertEquals(gameinfo.name, "DOOM Eternal")
            self.assertEquals(gameinfo.rating_score, 9)

    def test_steam_json_multiple_genres(self) -> None:
        with get_pagedriver() as driver:
            gameinfo = get_steam_info(driver, 1424910)
            self.assertIsNotNone(gameinfo)
            self.assertEquals(len(gameinfo.genres), 4)
            self.assertEquals(gameinfo.genres[0], "Action")


if __name__ == "__main__":
    unittest.main()

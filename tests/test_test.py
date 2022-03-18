import unittest

from app.pagedriver import get_pagedriver
from app.gameinfo import get_possible_steam_appid


class TestUtils(unittest.TestCase):
    def test_pagedriver(self) -> None:
        driver = get_pagedriver()
        self.assertIsNotNone(driver)

    def test_steam_appid_resolution(self) -> None:
        expected_id: int = 359550
        scraped_id: int = get_possible_steam_appid("Rainbow Six Siege")
        self.assertEquals(expected_id, scraped_id)


if __name__ == "__main__":
    unittest.main()

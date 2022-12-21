import unittest

from lootscraper.scraper.info.utils import clean_loot_title, get_match_score


class LocalTests(unittest.TestCase):
    def test_similarity_1(self) -> None:
        search = "Rainbow Six Siege"
        result = "Tom Clancy's Rainbow Six® Siege"

        score = get_match_score(search, result)
        self.assertEqual(score, 0.99)

    def test_similarity_2(self) -> None:
        search = "Fall Guys"
        result = "Fall Guy"

        score = get_match_score(search, result)
        self.assertLess(score, 0.99)

    def test_loot_title_cleaning_1(self) -> None:
        title = "Tom Clancy's Rainbow Six® Siege"
        cleaned = "Tom Clancy's Rainbow Six® Siege"

        self.assertEqual(clean_loot_title(title), cleaned)

    def test_loot_title_cleaning_2(self) -> None:
        title = "Lords Mobile: Warlord Pack"
        cleaned = "Lords Mobile"

        self.assertEqual(clean_loot_title(title), cleaned)

    def test_loot_title_cleaning_3(self) -> None:
        title = "Mobile Legends: Bang Bang: Amazon Prime Chest"
        cleaned = "Mobile Legends: Bang Bang"

        self.assertEqual(clean_loot_title(title), cleaned)

    def test_loot_title_cleaning_4(self) -> None:
        title = "Get up to GTA$400,000 this month in GTA Online"
        cleaned = "GTA Online"

        self.assertEqual(clean_loot_title(title), cleaned)

    def test_loot_title_cleaning_5(self) -> None:
        title = "Get up to GTA$400,000 this week in GTA Online"
        cleaned = "GTA Online"

        self.assertEqual(clean_loot_title(title), cleaned)

    def test_loot_title_cleaning_6(self) -> None:
        title = "World of Warships — Starter Pack: Dreadnought"
        cleaned = "World of Warships"

        self.assertEqual(clean_loot_title(title), cleaned)


if __name__ == "__main__":
    unittest.main()

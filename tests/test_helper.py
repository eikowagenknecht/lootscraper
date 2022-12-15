import unittest

from app.scraper.info.utils import get_match_score


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


if __name__ == "__main__":
    unittest.main()

# type: ignore
import logging
import unittest

from app.common import TIMESTAMP_LONG
from app.scraper.info.utils import get_match_score

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)-5s] %(message)s",
    datefmt=TIMESTAMP_LONG,
)


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

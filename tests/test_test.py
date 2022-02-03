import unittest

import scrape_prime_loot


class TestUtils(unittest.TestCase):
    def test_pagedriver(self) -> None:
        driver = scrape_prime_loot.get_pagedriver(False)
        self.assertIsNotNone(driver)


if __name__ == "__main__":
    unittest.main()

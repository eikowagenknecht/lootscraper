import unittest

from app.pagedriver import get_pagedriver


class TestUtils(unittest.TestCase):
    def test_pagedriver(self) -> None:
        driver = get_pagedriver(False)
        self.assertIsNotNone(driver)


if __name__ == "__main__":
    unittest.main()

from selenium.webdriver.chrome.webdriver import WebDriver

from app.common import LootOffer


class Scraper:
    @staticmethod
    def scrape(
        driver: WebDriver, options: dict[str, bool] = None
    ) -> dict[str, list[LootOffer]]:
        raise NotImplementedError("Please implement this method")

from selenium.webdriver.chrome.webdriver import WebDriver

from app.sqlalchemy import Offer


class Scraper:
    @staticmethod
    def scrape(
        driver: WebDriver, options: dict[str, bool] = None
    ) -> dict[str, list[Offer]]:
        raise NotImplementedError("Please implement this method")

import logging
import urllib.parse
from selenium.common.exceptions import WebDriverException
from selenium.webdriver.chrome.webdriver import WebDriver
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from app.pagedriver import get_pagedriver

ROOT_URL = "https://store.steampowered.com/search/?term="
OPTIONS = "&category1=998"  # Games only
MAX_WAIT_SECONDS = 60  # Needs to be quite high in Docker for first run
XPATH_WAIT = '//div[@id = "search_results"]'
XPATH_BEST_SEARCH_RESULT = '//div[@id = "search_result_container"]//a[1]'  # data-ds-appid contains the steam id


def get_possible_steam_appid(title: str) -> int:
    encoded_title = urllib.parse.quote_plus(title, safe="")
    appid_str: str

    url = ROOT_URL + encoded_title + OPTIONS
    try:
        driver: WebDriver
        with get_pagedriver() as driver:
            driver.get(url)

            logging.info(f"Trying to determine the Steam App ID for {title}")

            try:
                # Wait until the page loaded
                WebDriverWait(driver, MAX_WAIT_SECONDS).until(
                    EC.presence_of_element_located((By.XPATH, XPATH_WAIT))
                )

            except WebDriverException:  # type: ignore
                logging.error(f"Page took longer than {MAX_WAIT_SECONDS} to load")
                return 0

            try:
                element: WebElement = driver.find_element(
                    By.XPATH, XPATH_BEST_SEARCH_RESULT
                )
                appid_str: str = element.get_attribute("data-ds-appid")  # type: ignore

            except WebDriverException:  # type: ignore
                logging.error("No Steam results found for {title}!")
                return 0

            logging.info("Shutting down driver")
            driver.quit()
        logging.info("Shutdown complete")

    except WebDriverException as err:  # type: ignore
        logging.error(f"Failure starting Chrome WebDriver, aborting: {err.msg}")  # type: ignore
        raise err

    if appid_str is not None:
        return int(appid_str)

    return 0

import json
import logging
import urllib.parse
import urllib.request
from dataclasses import dataclass

from selenium.common.exceptions import WebDriverException
from selenium.webdriver.chrome.webdriver import WebDriver
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from app.pagedriver import get_pagedriver

STEAM_SEARCH_URL = "https://store.steampowered.com/search/?term="
STEAM_SEARCH_OPTIONS = "&category1=998"  # Games only
STEAM_SEARCH_RESULTS = '//div[@id = "search_results"]'
STEAM_SEARCH_BEST_RESULT = '//div[@id = "search_result_container"]//a[1]'  # data-ds-appid contains the steam id

STEAM_DETAILS_JSON = "https://store.steampowered.com/api/appdetails?appids="

STEAM_DETAILS_STORE = "https://store.steampowered.com/app/"
STEAM_DETAILS_REVIEW_SCORE = '//div[@id="userReviews"]/div[@itemprop="aggregateRating"]'  # data-tooltip-html attribute
STEAM_DETAILS_REVIEW_SCORE_VALUE = '//div[@id="userReviews"]/div[@itemprop="aggregateRating"]//meta[@itemprop="ratingValue"]'  # content attribute
MAX_WAIT_SECONDS = 60  # Needs to be quite high in Docker for first run


@dataclass
class Gameinfo:
    steam_id: int | None
    name: str | None = None
    short_description: str | None = None
    release_date: str | None = None
    recommended_price: str | None = None
    genre: str | None = None

    recommendations: int | None = None
    rating_percent: int | None = None
    rating_score: int | None = None
    metacritic_score: int | None = None
    metacritic_url: str | None = None


def get_possible_steam_appid(title: str) -> int:
    encoded_title = urllib.parse.quote_plus(title, safe="")
    appid_str: str

    url = STEAM_SEARCH_URL + encoded_title + STEAM_SEARCH_OPTIONS
    try:
        driver: WebDriver
        with get_pagedriver() as driver:
            driver.get(url)

            logging.info(f"Trying to determine the Steam App ID for {title}")

            try:
                # Wait until the page loaded
                WebDriverWait(driver, MAX_WAIT_SECONDS).until(
                    EC.presence_of_element_located((By.XPATH, STEAM_SEARCH_RESULTS))
                )

            except WebDriverException as err:  # type: ignore
                logging.error(f"Page took longer than {MAX_WAIT_SECONDS} to load")
                raise err

            try:
                element: WebElement = driver.find_element(
                    By.XPATH, STEAM_SEARCH_BEST_RESULT
                )
                appid_str: str = element.get_attribute("data-ds-appid")  # type: ignore

            except WebDriverException:  # type: ignore
                logging.error("No Steam results found for {title}!")

            logging.info("Shutting down driver")
            driver.quit()
        logging.info("Shutdown complete")

    except WebDriverException as err:  # type: ignore
        logging.error(f"Failure starting Chrome WebDriver, aborting: {err.msg}")  # type: ignore
        raise err

    if appid_str is not None:
        return int(appid_str)

    return 0


def get_steam_info(appid: int) -> Gameinfo:
    logging.info(f"Trying to determine the Details for Steam App ID {appid} from JSON")

    result = Gameinfo(appid)

    with urllib.request.urlopen(STEAM_DETAILS_JSON + str(appid)) as url:  # type: ignore  # nosec
        data = json.loads(url.read().decode())  # type: ignore
        try:
            result.name = data[str(appid)]["data"]["name"]  # type: ignore
        except KeyError:
            pass

        try:
            result.short_description = data[str(appid)]["data"]["short_description"]  # type: ignore
        except KeyError:
            pass

        try:
            result.genre = data[str(appid)]["data"]["genres"][0]["description"]  # type: ignore
        except KeyError:
            pass

        try:
            result.release_date = data[str(appid)]["data"]["release_date"]["date"]  # type: ignore
        except KeyError:
            pass

        try:
            recommended_price_value: int = data[str(appid)]["data"]["price_overview"]["initial"]  # type: ignore
            recommended_price_currency: str = data[str(appid)]["data"]["price_overview"]["currency"]  # type: ignore
            result.recommended_price = (
                f"{recommended_price_value / 100} {recommended_price_currency}"
            )
        except KeyError:
            pass

        try:
            result.recommendations = data[str(appid)]["data"]["recommendations"]["total"]  # type: ignore
        except KeyError:
            pass

        try:
            result.metacritic_score = data[str(appid)]["data"]["metacritic"]["score"]  # type: ignore
        except KeyError:
            pass

        try:
            metacritic_url: str = data[str(appid)]["data"]["metacritic"]["url"]  # type: ignore
            result.metacritic_url = metacritic_url.replace(R"\/", "/")
        except KeyError:
            pass

    logging.info(
        f"Trying to determine the Details for Steam App ID {appid} from Steam store"
    )

    try:
        driver: WebDriver
        with get_pagedriver() as driver:
            driver.get(STEAM_DETAILS_STORE + str(appid))

            try:
                # Wait until the page loaded
                WebDriverWait(driver, MAX_WAIT_SECONDS).until(
                    EC.presence_of_element_located(
                        (By.XPATH, STEAM_DETAILS_REVIEW_SCORE)
                    )
                )

            except WebDriverException as err:  # type: ignore
                logging.error(f"Page took longer than {MAX_WAIT_SECONDS} to load")
                raise err

            try:
                element: WebElement = driver.find_element(
                    By.XPATH, STEAM_DETAILS_REVIEW_SCORE
                )
                rating_str: str = element.get_attribute("data-tooltip-html")  # type: ignore
                result.rating_percent = int(rating_str.split("%")[0].strip())

            except WebDriverException:  # type: ignore
                logging.error("No Steam percentage found for {title}!")

            try:
                element2: WebElement = element.find_element(
                    By.XPATH, STEAM_DETAILS_REVIEW_SCORE_VALUE
                )
                rating_str: str = element2.get_attribute("content")  # type: ignore
                result.rating_score = int(rating_str)

            except WebDriverException:  # type: ignore
                logging.error("No Steam absolute rating found for {title}!")

            logging.info("Shutting down driver")
            driver.quit()
        logging.info("Shutdown complete")

    except WebDriverException as err:  # type: ignore
        logging.error(f"Failure starting Chrome WebDriver, aborting: {err.msg}")  # type: ignore
        raise err

    return result
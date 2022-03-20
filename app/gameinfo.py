from __future__ import annotations

import difflib
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
from selenium.webdriver.support.ui import Select, WebDriverWait

STEAM_SEARCH_URL = "https://store.steampowered.com/search/?term="
STEAM_SEARCH_OPTIONS = "&category1=998"  # Games only
STEAM_SEARCH_RESULTS_CONTAINER = '//div[@id = "search_results"]'
STEAM_SEARCH_RESULTS = (
    '//div[@id = "search_result_container"]//a'  # data-ds-appid contains the steam id
)

STEAM_DETAILS_JSON = "https://store.steampowered.com/api/appdetails?appids="

STEAM_DETAILS_STORE = "https://store.steampowered.com/app/"
STEAM_DETAILS_REVIEW_SCORE = '//div[@id="userReviews"]/div[@itemprop="aggregateRating"]'  # data-tooltip-html attribute
STEAM_DETAILS_REVIEW_SCORE_VALUE = '//div[@id="userReviews"]/div[@itemprop="aggregateRating"]//meta[@itemprop="ratingValue"]'  # content attribute
STEAM_DETAILS_LOADED = '//div[contains(concat(" ", normalize-space(@class), " "), " game_page_background ")]'
STEAM_PRICE_FULL = '(//div[contains(concat(" ", normalize-space(@class), " "), " game_area_purchase_game ")])[1]//div[contains(concat(" ", normalize-space(@class), " "), " game_purchase_action")]//div[contains(concat(" ", normalize-space(@class), " "), " game_purchase_price")]'  # text=" 27,99€ "
STEAM_PRICE_DISCOUNTED_ORIGINAL = '(//div[contains(concat(" ", normalize-space(@class), " "), " game_area_purchase_game ")])[1]//div[contains(concat(" ", normalize-space(@class), " "), " game_purchase_action")]//div[contains(concat(" ", normalize-space(@class), " "), " discount_original_price")]'  # text=" 27,99€ "
MAX_WAIT_SECONDS = 30  # Needs to be quite high in Docker for first run


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
    shop_url: str | None = None

    @classmethod
    def from_json(cls, json_str: str) -> Gameinfo:
        dictionary = json.loads(json_str)  # type: ignore

        result: Gameinfo = Gameinfo(dictionary["steam_id"])  # type: ignore
        try:
            result.name = dictionary["name"]  # type: ignore
        except KeyError:
            pass

        try:
            result.short_description = dictionary["short_description"]  # type: ignore
        except KeyError:
            pass

        try:
            result.release_date = dictionary["release_date"]  # type: ignore
        except KeyError:
            pass

        try:
            result.recommended_price = dictionary["recommended_price"]  # type: ignore
        except KeyError:
            pass

        try:
            result.genre = dictionary["genre"]  # type: ignore
        except KeyError:
            pass

        try:
            result.recommendations = dictionary["recommendations"]  # type: ignore
        except KeyError:
            pass

        try:
            result.rating_percent = dictionary["rating_percent"]  # type: ignore
        except KeyError:
            pass

        try:
            result.rating_score = dictionary["rating_score"]  # type: ignore
        except KeyError:
            pass

        try:
            result.metacritic_score = dictionary["metacritic_score"]  # type: ignore
        except KeyError:
            pass

        try:
            result.metacritic_url = dictionary["metacritic_url"]  # type: ignore
        except KeyError:
            pass

        try:
            result.shop_url = dictionary["shop_url"]  # type: ignore
        except KeyError:
            pass

        return result


def get_possible_steam_appid(driver: WebDriver, title: str) -> int:
    encoded_title = urllib.parse.quote_plus(title, safe="")

    url = STEAM_SEARCH_URL + encoded_title + STEAM_SEARCH_OPTIONS

    driver.get(url)

    logging.info(f"Trying to determine the Steam App ID for {title}")

    try:
        # Wait until the page loaded
        WebDriverWait(driver, MAX_WAIT_SECONDS).until(
            EC.presence_of_element_located((By.XPATH, STEAM_SEARCH_RESULTS_CONTAINER))
        )

    except WebDriverException:  # type: ignore
        logging.error(f"Search results not found after waiting {MAX_WAIT_SECONDS}s")
        return 0

    # Read all results and use the one with the highest difflib score (lower cased!)
    best_appid: int | None = None
    best_score: float = 0
    best_title: str | None = None
    try:
        elements: list[WebElement] = driver.find_elements(
            By.XPATH, STEAM_SEARCH_RESULTS
        )
        for element in elements:
            try:
                title_element = element.find_element(By.CLASS_NAME, "title")  # type: ignore
                title_str: str = title_element.text  # type: ignore

                score = difflib.SequenceMatcher(
                    a=title_str.lower(), b=title.lower()
                ).ratio()
                if score > best_score and score > 0.8:
                    best_appid = int(element.get_attribute("data-ds-appid"))  # type: ignore
                    best_score = score
                    best_title = title_str
                    logging.info(f"{title_str} has a score of {(score*100):.0f} %")
                else:
                    logging.info(
                        f"Ignoring {title_str} as it's score of {(score*100):.0f} is too low"
                    )
            except WebDriverException:  # type: ignore
                continue
            except ValueError:
                continue

    except WebDriverException:  # type: ignore
        logging.error("No Steam results found for {title}!")

    # Don't use any in the highest difflib score is <0.8
    if best_appid is not None:
        logging.info(
            f"Using {best_title} as it has the highest score ({(best_score*100):.0f})"
        )
        return best_appid

    return 0


def get_steam_info(driver: WebDriver, title: str) -> Gameinfo | None:
    logging.info(f"Trying to determine the Details for {title} from JSON")

    appid = get_possible_steam_appid(driver, title)

    if appid == 0:
        logging.info(f"No match found for {title}")
        return None

    result = Gameinfo(appid)

    with urllib.request.urlopen(STEAM_DETAILS_JSON + str(appid)) as url:  # type: ignore  # nosec
        data = json.loads(url.read().decode())  # type: ignore
        try:
            result.name = data[str(appid)]["data"]["name"]  # type: ignore
            logging.info(
                f"Found entry {result.name} ({appid}) for search query {title}"
            )
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

    # We do not save prices in any other currency than EUR
    if (
        result.recommended_price
        and not result.recommended_price.endswith("EUR")
        or result.recommended_price == "Free"
    ):
        result.recommended_price = None

    logging.info(
        f"Trying to determine the Details for Steam App ID {appid} from Steam store"
    )

    result.shop_url = STEAM_DETAILS_STORE + str(appid)

    driver.get(STEAM_DETAILS_STORE + str(appid))

    try:
        # Wait until the page loaded
        WebDriverWait(driver, MAX_WAIT_SECONDS).until(
            EC.presence_of_element_located((By.XPATH, STEAM_DETAILS_LOADED))
        )

    except WebDriverException:  # type: ignore
        logging.error(
            f"Steam store page for {appid} didn't load after waiting for {MAX_WAIT_SECONDS}s"
        )
        pass

    # For some games an age verification is needed. We have to skip that to see
    # the interesting parts. So enter a valid date and then move on.
    # (use e.g. 12 July 1990), then move on to the actual shop page
    if "agecheck" in driver.current_url:
        try:
            select = Select(driver.find_element_by_id('ageDay'))
            select.select_by_value("12")
            select = Select(driver.find_element_by_id('ageMonth'))
            select.select_by_value("March")
            select = Select(driver.find_element_by_id('ageYear'))
            select.select_by_value("1990")
            driver.find_element(By.ID, "view_product_page_btn").click()
            WebDriverWait(driver, MAX_WAIT_SECONDS).until(
                EC.presence_of_element_located((By.XPATH, STEAM_DETAILS_REVIEW_SCORE))
            )
        except WebDriverException:  # type: ignore
            logging.error("Something went wrong trying to pass the age verification")

    try:
        element: WebElement = driver.find_element(By.XPATH, STEAM_DETAILS_REVIEW_SCORE)
        rating_str: str = element.get_attribute("data-tooltip-html")  # type: ignore
        result.rating_percent = int(rating_str.split("%")[0].strip())

    except WebDriverException:  # type: ignore
        logging.error(f"No Steam percentage found for {appid}!")

    except ValueError:
        logging.error(f"Invalid Steam percentage {rating_str} for {appid}!")

    try:
        element2: WebElement = driver.find_element(
            By.XPATH, STEAM_DETAILS_REVIEW_SCORE_VALUE
        )
        rating_str: str = element2.get_attribute("content")  # type: ignore
        try:
            result.rating_score = int(rating_str)
        except ValueError:
            pass

    except WebDriverException:  # type: ignore
        logging.error(f"No Steam rating found for {appid}!")

    except ValueError:
        logging.error(f"Invalid Steam rating {rating_str} for {appid}!")

    if result.recommended_price is None:
        try:
            element3: WebElement = driver.find_element(
                By.XPATH, STEAM_PRICE_DISCOUNTED_ORIGINAL
            )
            price_str: str = element3.text  # type: ignore
            try:
                price = float(price_str.replace("€", "").replace(",", ".").strip())
                result.recommended_price = str(price) + " EUR"
            except ValueError:
                pass

        except WebDriverException:  # type: ignore
            logging.info(f"No Steam discounted original price found for {appid}!")

    if result.recommended_price is None:
        try:
            element4: WebElement = driver.find_element(By.XPATH, STEAM_PRICE_FULL)
            price_str: str = element4.text.replace("€", "").strip()  # type: ignore
            if price_str.lower() == "free to play":
                result.recommended_price = "Free"
            else:
                try:
                    price = float(price_str)
                    result.recommended_price = str(price) + " EUR"
                except ValueError:
                    pass

        except WebDriverException:  # type: ignore
            logging.error(f"No Steam price found for {appid}!")

    return result

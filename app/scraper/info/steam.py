import json
import logging
import urllib.parse
import urllib.request
from datetime import datetime, timezone

from selenium.common.exceptions import WebDriverException
from selenium.webdriver.chrome.webdriver import WebDriver
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select, WebDriverWait

from app.scraper.info.utils import RESULT_MATCH_THRESHOLD, get_match_score
from app.sqlalchemy import SteamInfo

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


def get_steam_id(search_string: str, driver: WebDriver) -> int | None:
    logging.info(f"Getting id for {search_string}")

    encoded_searchstring = urllib.parse.quote_plus(search_string, safe="")

    url = STEAM_SEARCH_URL + encoded_searchstring + STEAM_SEARCH_OPTIONS
    driver.get(url)

    try:
        # Wait until the page loaded
        WebDriverWait(driver, MAX_WAIT_SECONDS).until(
            EC.presence_of_element_located((By.XPATH, STEAM_SEARCH_RESULTS_CONTAINER))
        )

    except WebDriverException:
        logging.error(
            f"Problem loading search results for {search_string} after waiting {MAX_WAIT_SECONDS}s"
        )
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
                title_element = element.find_element(By.CLASS_NAME, "title")
                result: str = title_element.text

                score = get_match_score(search_string, result)

                if score >= RESULT_MATCH_THRESHOLD and score > best_score:
                    best_appid = int(element.get_attribute("data-ds-appid"))  # type: ignore
                    best_score = score
                    best_title = result
                    logging.debug(
                        f"Steam: Found match {result} with a score of {(score*100):.0f} %"
                    )
                else:
                    logging.debug(
                        f"Steam: Ignoring {result} as it's score of {(score*100):.0f} % is too low"
                    )
            except WebDriverException:
                continue
            except ValueError:
                continue

    except WebDriverException:
        logging.info("Steam: No search results found for {title}!")

    if best_appid is not None:
        logging.info(
            f"Steam: Search for {search_string} resulted in {best_title} ({best_appid}) as the best match with a score of {(best_score*100):.0f} %"
        )
        return best_appid

    logging.info(f"Steam: Search for {search_string} found no result")

    return None


def get_steam_details(
    driver: WebDriver, id: int | None = None, title: str | None = None
) -> SteamInfo | None:
    steam_app_id: int | None = None

    if id:
        steam_app_id = id

    if not steam_app_id and title:
        steam_app_id = get_steam_id(title, driver)

    if not steam_app_id:
        # No entry found, not adding any data
        return None

    logging.info(f"Steam: Reading details for app id {id}")

    steam_info = SteamInfo()
    steam_info.id = steam_app_id

    with urllib.request.urlopen(STEAM_DETAILS_JSON + str(steam_app_id)) as url:  # nosec
        data = json.loads(url.read().decode())
        try:
            steam_info.name = data[str(steam_app_id)]["data"]["name"]
        except KeyError:
            pass

        try:
            steam_info.short_description = data[str(steam_app_id)]["data"][
                "short_description"
            ]
        except KeyError:
            pass

        try:
            genres: list[str] = []
            for genre in data[str(steam_app_id)]["data"]["genres"]:
                genres.append(genre["description"])
            steam_info.genres = ", ".join(genres)
        except KeyError:
            pass

        try:
            date_string = data[str(steam_app_id)]["data"]["release_date"]["date"]
            timestamp = datetime.strptime(date_string, "%d %b, %Y")
            steam_info.release_date = timestamp.replace(tzinfo=timezone.utc)
        except (KeyError, ValueError):
            pass

        try:
            # We do not save prices in any other currency than EUR (or free)
            recommended_price_value: int = data[str(steam_app_id)]["data"][
                "price_overview"
            ]["initial"]
            if (
                recommended_price_value == 0
                or data[str(steam_app_id)]["data"]["price_overview"]["currency"]
                == "EUR"
            ):
                steam_info.recommended_price_eur = recommended_price_value / 100
        except (KeyError, ValueError):
            pass

        try:
            steam_info.recommendations = data[str(steam_app_id)]["data"][
                "recommendations"
            ]["total"]
        except KeyError:
            pass

        try:
            steam_info.metacritic_score = data[str(steam_app_id)]["data"]["metacritic"][
                "score"
            ]
        except KeyError:
            pass

        try:
            steam_info.metacritic_url = data[str(steam_app_id)]["data"]["metacritic"][
                "url"
            ].replace(R"\/", "/")
        except KeyError:
            pass

        try:
            # Prefer header image over first screenshot
            steam_info.image_url = data[str(steam_app_id)]["data"]["screenshots"][0][
                "path_full"
            ].replace(R"\/", "/")
            steam_info.image_url = data[str(steam_app_id)]["data"][
                "header_image"
            ].replace(R"\/", "/")
        except KeyError:
            pass

        try:
            steam_info.publishers = ", ".join(
                data[str(steam_app_id)]["data"]["publishers"]
            )
        except KeyError:
            pass

    logging.debug(
        f"Steam: Now also checking the store details page for app id {steam_app_id}"
    )

    steam_info.url = STEAM_DETAILS_STORE + str(steam_info.id)
    driver.get(steam_info.url)

    try:
        # Wait until the page loaded
        WebDriverWait(driver, MAX_WAIT_SECONDS).until(
            EC.presence_of_element_located((By.XPATH, STEAM_DETAILS_LOADED))
        )

    except WebDriverException:
        logging.error(
            f"Steam store page for {steam_app_id} didn't load after waiting for {MAX_WAIT_SECONDS}s"
        )
        pass

    # For some games an age verification is needed. We have to skip that to see
    # the interesting parts. So enter a valid date and then move on.
    # (use e.g. 12 July 1990), then move on to the actual shop page
    if "agecheck" in driver.current_url:
        logging.debug(f"Trying to pass age verification for {steam_app_id}")
        try:
            select_field = Select(driver.find_element_by_id("ageDay"))
            select_field.select_by_value("12")
            select_field = Select(driver.find_element_by_id("ageMonth"))
            select_field.select_by_value("March")
            select_field = Select(driver.find_element_by_id("ageYear"))
            select_field.select_by_value("1990")
            driver.find_element(By.ID, "view_product_page_btn").click()
            WebDriverWait(driver, MAX_WAIT_SECONDS).until(
                EC.presence_of_element_located((By.XPATH, STEAM_DETAILS_REVIEW_SCORE))
            )
            logging.debug(f"Passed age verification for {steam_app_id}")
        except WebDriverException:
            logging.error("Something went wrong trying to pass the age verification")

    try:
        element: WebElement = driver.find_element(By.XPATH, STEAM_DETAILS_REVIEW_SCORE)
        rating_str: str = element.get_attribute("data-tooltip-html")  # type: ignore
        steam_info.percent = int(rating_str.split("%")[0].strip())

    except WebDriverException:
        logging.error(f"No Steam percentage found for {steam_app_id}!")

    except ValueError:
        logging.error(f"Invalid Steam percentage {rating_str} for {steam_app_id}!")

    try:
        element2: WebElement = driver.find_element(
            By.XPATH, STEAM_DETAILS_REVIEW_SCORE_VALUE
        )
        rating2_str: str = element2.get_attribute("content")  # type: ignore
        try:
            steam_info.score = int(rating2_str)
        except ValueError:
            pass

    except WebDriverException:
        logging.error(f"No Steam rating found for {steam_app_id}!")

    except ValueError:
        logging.error(f"Invalid Steam rating {rating2_str} for {steam_app_id}!")

    if steam_info.recommended_price_eur is None:
        try:
            element3: WebElement = driver.find_element(
                By.XPATH, STEAM_PRICE_DISCOUNTED_ORIGINAL
            )
            price_str: str = element3.text
            try:
                steam_info.recommended_price_eur = float(
                    price_str.replace("€", "").replace(",", ".").strip()
                )
            except ValueError:
                pass

        except WebDriverException:
            logging.debug(
                f"No Steam discounted original price found on shop page for {steam_app_id}"
            )

    if steam_info.recommended_price_eur is None:
        try:
            element4: WebElement = driver.find_element(By.XPATH, STEAM_PRICE_FULL)
            price2_str: str = element4.text.replace("€", "").strip()
            if "free" in price2_str.lower():
                steam_info.recommended_price_eur = 0
            else:
                try:
                    steam_info.recommended_price_eur = float(price2_str)
                except ValueError:
                    pass

        except WebDriverException:
            logging.debug(f"No Steam full price found on shop page for {steam_app_id}")

    if steam_info.recommended_price_eur is None:
        logging.error(f"No Steam price found for {steam_app_id}")

    return steam_info

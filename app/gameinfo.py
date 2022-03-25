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

RESULT_MATCH_THRESHOLD = 0.8


@dataclass
class Gameinfo:
    steam_id: int | None
    name: str | None = None
    short_description: str | None = None
    release_date: str | None = None
    recommended_price: str | None = None
    genres: list[str] | None = None

    recommendations: int | None = None
    rating_percent: int | None = None
    rating_score: int | None = None
    metacritic_score: int | None = None
    metacritic_url: str | None = None
    shop_url: str | None = None
    image_url: str | None = None

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
            result.genres = dictionary["genres"]  # type: ignore
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

        try:
            result.image_url = dictionary["image_url"]  # type: ignore
        except KeyError:
            pass

        return result


def get_possible_steam_appid(driver: WebDriver, searchstring: str) -> int:
    encoded_searchstring = urllib.parse.quote_plus(searchstring, safe="")

    url = STEAM_SEARCH_URL + encoded_searchstring + STEAM_SEARCH_OPTIONS
    driver.get(url)

    try:
        # Wait until the page loaded
        WebDriverWait(driver, MAX_WAIT_SECONDS).until(
            EC.presence_of_element_located((By.XPATH, STEAM_SEARCH_RESULTS_CONTAINER))
        )

    except WebDriverException:  # type: ignore
        logging.error(
            f"Problem loading search results for {searchstring} after waiting {MAX_WAIT_SECONDS}s"
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
                title_element = element.find_element(By.CLASS_NAME, "title")  # type: ignore
                result: str = title_element.text  # type: ignore

                cleaned_searchstring = (
                    searchstring.replace("™", "")
                    .replace("©", "")
                    .replace("®", "")
                    .replace("  ", " ")
                ).lower()

                cleaned_result = (
                    result.replace("™", "")
                    .replace("©", "")
                    .replace("®", "")
                    .replace("  ", " ")
                ).lower()

                score = difflib.SequenceMatcher(
                    a=cleaned_searchstring, b=cleaned_result
                ).ratio()

                if score < RESULT_MATCH_THRESHOLD:
                    # If it is no match, look for a partial match instead. Look at the first x or last x words from the
                    # result because the result often includes additional text (e.g. a prepended "Tom Clancy's ...") or
                    # an appended " - Ultimate edition". x is the number of words the search term has.

                    words_result = cleaned_result.split(" ")
                    words_searchstring = cleaned_searchstring.split(" ")

                    score = max(
                        score,
                        difflib.SequenceMatcher(
                            a=cleaned_searchstring,
                            b=" ".join(words_result[: len(words_searchstring)]).lower(),
                        ).ratio(),
                    )
                    score = max(
                        score,
                        difflib.SequenceMatcher(
                            a=cleaned_searchstring,
                            b=" ".join(
                                words_result[-len(words_searchstring) :]
                            ).lower(),
                        ).ratio(),
                    )
                    pass

                if score >= RESULT_MATCH_THRESHOLD:
                    best_appid = int(element.get_attribute("data-ds-appid"))  # type: ignore
                    best_score = score
                    best_title = result
                    logging.debug(
                        f"Found match {result} with a score of {(score*100):.0f} %"
                    )
                    # Intentionally do not look for further matches if the first is good enough because most of the
                    # times the first Steam result is an exact match.
                    break
                else:
                    logging.debug(
                        f"Ignoring {result} as it's score of {(score*100):.0f} % is too low"
                    )
            except WebDriverException:  # type: ignore
                continue
            except ValueError:
                continue

    except WebDriverException:  # type: ignore
        logging.info("No search results found for {title}!")

    # Don't use any in the highest difflib score is <0.8
    if best_appid is not None:
        logging.info(
            f"Search for {searchstring} resulted in {best_title} ({best_appid}) as the best match with a score of {(best_score*100):.0f} %"
        )
        return best_appid

    logging.info(f"Search for {searchstring} found no result")

    return 0


def get_steam_info(driver: WebDriver, title: str | int) -> Gameinfo | None:
    logging.info(f"Reading Steam details for {title}")
    if isinstance(title, int):
        appid = title
    else:
        appid = get_possible_steam_appid(driver, title)

    if appid == 0:
        return None

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
            result.genres = []
            for genre in data[str(appid)]["data"]["genres"]:  # type: ignore
                result.genres.append(genre["description"])  # type: ignore
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

        try:
            image_url: str = data[str(appid)]["data"]["screenshots"][0]["path_full"]  # type: ignore
            result.image_url = image_url.replace(R"\/", "/")
        except KeyError:
            pass

    # We do not save prices in any other currency than EUR
    if (
        result.recommended_price
        and not result.recommended_price.endswith("EUR")
        or result.recommended_price == "Free"
    ):
        result.recommended_price = None

    logging.debug(f"Now also checking the Steam store details page for app id {appid}")

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
        logging.debug(f"Trying to pass age verification for {appid}")
        try:
            select = Select(driver.find_element_by_id("ageDay"))
            select.select_by_value("12")
            select = Select(driver.find_element_by_id("ageMonth"))
            select.select_by_value("March")
            select = Select(driver.find_element_by_id("ageYear"))
            select.select_by_value("1990")
            driver.find_element(By.ID, "view_product_page_btn").click()
            WebDriverWait(driver, MAX_WAIT_SECONDS).until(
                EC.presence_of_element_located((By.XPATH, STEAM_DETAILS_REVIEW_SCORE))
            )
            logging.debug(f"Passed age verification for {appid}")
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
            logging.debug(
                f"No Steam discounted original price found on shop page for {appid}"
            )

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
            logging.debug(f"No Steam full price found on shop page for {appid}")

    if result.recommended_price is None:
        logging.error(f"No Steam price found for {appid}")

    return result

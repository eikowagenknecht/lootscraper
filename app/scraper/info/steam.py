import json
import logging
import urllib.parse
import urllib.request
from datetime import datetime, timezone

from playwright.async_api import BrowserContext, Error, Page

from app.scraper.info.utils import RESULT_MATCH_THRESHOLD, get_match_score
from app.sqlalchemy import SteamInfo

logger = logging.getLogger(__name__)

STEAM_SEARCH_URL = "https://store.steampowered.com/search/?term="
STEAM_SEARCH_URL_OPTIONS = "&category1=998"  # Games only
STEAM_DETAILS_JSON_URL = "https://store.steampowered.com/api/appdetails?appids="
STEAM_DETAILS_STORE_URL = "https://store.steampowered.com/app/"

STEAM_DETAILS_REVIEW_SCORE = '//div[@id="userReviews"]/div[@itemprop="aggregateRating"]'  # data-tooltip-html attribute
STEAM_DETAILS_REVIEW_SCORE_VALUE = '//div[@id="userReviews"]/div[@itemprop="aggregateRating"]//meta[@itemprop="ratingValue"]'  # content attribute
STEAM_DETAILS_REVIEW_COUNT = '//div[@id="userReviews"]/div[@itemprop="aggregateRating"]//meta[@itemprop="reviewCount"]'  # content attribute
STEAM_DETAILS_LOADED = '//div[contains(concat(" ", normalize-space(@class), " "), " game_page_background ")]'
STEAM_PRICE_FULL = '(//div[contains(concat(" ", normalize-space(@class), " "), " game_area_purchase_game ")])[1]//div[contains(concat(" ", normalize-space(@class), " "), " game_purchase_action")]//div[contains(concat(" ", normalize-space(@class), " "), " game_purchase_price")]'  # text=" 27,99€ "
STEAM_PRICE_DISCOUNTED_ORIGINAL = '(//div[contains(concat(" ", normalize-space(@class), " "), " game_area_purchase_game ")])[1]//div[contains(concat(" ", normalize-space(@class), " "), " game_purchase_action")]//div[contains(concat(" ", normalize-space(@class), " "), " discount_original_price")]'  # text=" 27,99€ "
STEAM_RELEASE_DATE = '//div[@id="genresAndManufacturer"]'

# TODO: Check if this still needs to be set so high with Playwright
MAX_WAIT_SECONDS = 30  # Needs to be quite high in Docker for first run


async def get_steam_id(search_string: str, context: BrowserContext) -> int | None:
    logger.info(f"Getting id for {search_string}.")

    encoded_searchstring = urllib.parse.quote_plus(search_string, safe="")

    url = STEAM_SEARCH_URL + encoded_searchstring + STEAM_SEARCH_URL_OPTIONS

    # TODO: Put this into a context manager to make sure the page is always closed after usage
    page = await context.new_page()
    await page.goto(url)

    # TODO:Maybe not needed any more with Playright auto-waiting?
    try:
        await page.wait_for_selector("#search_results")
    except Error:
        logger.error(f"Problem loading search results for {search_string}.")
        return None

    # Read all results and use the one with the highest difflib score (lower cased!)
    best_appid: int | None = None
    best_score: float | None = None
    best_title: str | None = None

    elements = (
        page.locator("#search_result_container")
        .locator("a")
        .filter(has=page.locator(".title"))
    )

    no_res = await elements.count()

    for i in range(no_res):
        element = elements.nth(i)
        try:
            result = await element.locator(".title").text_content()
            appid = await element.get_attribute("data-ds-appid")

            if not result or not appid:
                raise ValueError("Result does not contain a title or appid.")

            score = get_match_score(search_string, result)

            if best_score is None or (
                score >= RESULT_MATCH_THRESHOLD and score > best_score
            ):
                best_appid = int(appid)
                best_score = score
                best_title = result
                logger.debug(
                    f"Steam: Found match {result} with a score of {(score*100):.0f} %."
                )
            else:
                logger.debug(
                    f"Steam: Ignoring {result} as it's score of {(score*100):.0f} % is too low."
                )
        except Error as e:
            # Log problem with reading a result, but continue with the next one
            logger.warning(str(e))
            continue
        except ValueError as e:
            # Log problem with reading a result, but continue with the next one
            logger.warning(str(e))
            continue

    if best_appid is not None and best_score is not None and best_title is not None:
        logger.info(
            f"Steam: Search for {search_string} resulted in {best_title} ({best_appid}) as the best match with a score of {(best_score*100):.0f} %."
        )
        return best_appid

    logger.info(f"Steam: Search for {search_string} found no result.")

    return None


async def skip_age_verification(page: Page, steam_app_id: int) -> None:
    """
    For some games an age verification is needed. Skip this to see the
    interesting parts. We do this by entering the static date of 12 July 1990,
    then click the button to continue.
    """
    if "agecheck" in page.url:
        logger.debug(f"Trying to pass age verification for {steam_app_id}")
        await page.select_option("#ageDay", "12")
        await page.select_option("#ageMonth", "March")
        await page.select_option("#ageYear", "1990")
        await page.click("#view_product_page_btn")
        await page.wait_for_selector(
            "#userReviews"
        )  # TODO: Maybe not needed any more with Playright auto-waiting?
        logger.debug(f"Passed age verification for {steam_app_id}")


async def get_steam_details(
    context: BrowserContext, id_: int | None = None, title: str | None = None
) -> SteamInfo | None:
    steam_app_id: int | None = None

    if id_:
        steam_app_id = id_

    if not steam_app_id and title:
        steam_app_id = await get_steam_id(title, context)

    if not steam_app_id:
        # No entry found, not adding any data
        return None

    logger.info(f"Steam: Reading details for app id {steam_app_id}.")

    steam_info = SteamInfo()
    steam_info.id = steam_app_id
    steam_info.url = STEAM_DETAILS_STORE_URL + str(steam_info.id)

    # TODO: Use an asynchronous http client
    with urllib.request.urlopen(
        STEAM_DETAILS_JSON_URL + str(steam_app_id)
    ) as url:  # nosec
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

    logger.debug(
        f"Steam: Now also checking the store details page for app id {steam_app_id}."
    )

    page = await context.new_page()
    await page.goto(steam_info.url)

    try:
        await page.wait_for_selector(STEAM_DETAILS_LOADED)
    except Error:
        logger.error(f"Steam store page for {steam_app_id} didn't load.")
        return steam_info

    try:
        await skip_age_verification(page, steam_app_id)
    except Error:
        logger.error(f"Steam age verification for {steam_app_id} failed.")
        return steam_info

    # Get the review score percentage (if available)
    try:
        review_score_percent = (
            await page.locator("#userReviews")
            .locator('div[itemprop="aggregateRating"]')
            .get_attribute("data-tooltip-html")
        )
        if review_score_percent is None:
            logger.warning(f"No Steam percentage found for {steam_app_id}.")
        elif review_score_percent.startswith("Need more user reviews"):
            # No percentage, but this reason is fine
            pass
        else:
            steam_info.percent = int(review_score_percent.split("%")[0].strip())
    except Error:
        logger.warning(f"No Steam percentage found for {steam_app_id}.")
    except ValueError as e:
        logger.error(f"Invalid Steam percentage for {steam_app_id} ({str(e)}).")

    # Get the review score (if available)
    try:
        review_score = await page.locator(
            STEAM_DETAILS_REVIEW_SCORE_VALUE
        ).get_attribute("content")
        if review_score is None:
            logger.warning(f"No Steam rating found for {steam_app_id}.")
        else:
            steam_info.score = int(review_score)
    except Error:
        logger.warning(f"No Steam rating found for {steam_app_id}!")
    except ValueError as e:
        logger.error(f"Invalid Steam rating for {steam_app_id} ({str(e)}).")

    # Get the number of recommendations (if they were not filled by the API call)
    if steam_info.recommendations is None:
        try:
            recommendations = await page.locator(
                STEAM_DETAILS_REVIEW_COUNT
            ).get_attribute("content")
            if recommendations is None:
                logger.warning(f"No Steam rating found for {steam_app_id}.")
            else:
                steam_info.recommendations = int(recommendations)
        except Error:
            logger.warning(f"No Steam rating found for {steam_app_id}!")
        except ValueError as e:
            logger.error(f"Invalid Steam rating for {steam_app_id} ({str(e)}).")

    # Get the recommended price (if it was not filled by the API call)
    if steam_info.recommended_price_eur is None:
        try:
            recommended_price = await page.locator(
                STEAM_PRICE_DISCOUNTED_ORIGINAL
            ).text_content()
            if recommended_price is None:
                logger.info(
                    f"No Steam original price found on shop page for {steam_app_id}."
                )
            else:
                steam_info.recommended_price_eur = float(
                    recommended_price.replace("€", "").replace(",", ".").strip()
                )
        except Error:
            logger.info(
                f"No Steam original price found on shop page for {steam_app_id}."
            )
        except ValueError as e:
            logger.error(
                f"Steam original price has wrong format for {steam_app_id} ({str(e)})."
            )

    # Get the recommended price (if it was not filled by the API call or the other search)
    if steam_info.recommended_price_eur is None:
        try:
            recommended_price = await page.locator(STEAM_PRICE_FULL).text_content()
            if recommended_price is None:
                logger.info(
                    f"No Steam recommended price found on shop page for {steam_app_id}."
                )
            elif "free" in recommended_price.lower():
                steam_info.recommended_price_eur = 0
            else:
                steam_info.recommended_price_eur = float(
                    recommended_price.replace("€", "").replace(",", ".").strip()
                )
        except Error:
            logger.error(
                f"No Steam recommended price found on shop page for {steam_app_id}."
            )
        except ValueError as e:
            logger.error(
                f"Steam recommended price has wrong format for {steam_app_id} ({str(e)})."
            )

    # Get the release date (if it was not filled by the API call)
    if steam_info.release_date is None:
        try:
            release_date_str = await page.locator(STEAM_RELEASE_DATE).text_content()
            if release_date_str is None:
                logger.debug(f"No release date found on shop page for {steam_app_id}")
            else:
                release_date_str = release_date_str.split("RELEASE DATE:")[1].strip()
                release_date = datetime.strptime(release_date_str, "%d %b, %Y").replace(
                    tzinfo=timezone.utc
                )
                steam_info.release_date = release_date

        except Error:
            logger.debug(f"No release date found on shop page for {steam_app_id}.")
        except (IndexError, ValueError) as e:
            logger.error(
                f"Release date in wrong format on shop page for {steam_app_id} ({str(e)})."
            )
    return steam_info

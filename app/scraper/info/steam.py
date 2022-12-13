import logging
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import httpx
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


@dataclass
class SteamEntry:
    appid: int
    score: float
    title: str


async def get_steam_id(
    search_string: str,
    *,
    context: BrowserContext,
) -> int | None:
    """
    Search Steam via the web page and return the best match in the results.
    The omparison is done with difflib, lower cased.
    """

    logger.info(f"Getting Steam id for {search_string}.")

    encoded_searchstring = urllib.parse.quote_plus(search_string, safe="")
    url = STEAM_SEARCH_URL + encoded_searchstring + STEAM_SEARCH_URL_OPTIONS

    page = await context.new_page()

    try:
        await page.goto(url)

        best_match: SteamEntry | None = None

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

                if best_match is None or (
                    score >= RESULT_MATCH_THRESHOLD and score > best_match.score
                ):
                    logger.debug(
                        f"Steam: Found match {result} with a score of {(score*100):.0f} %."
                    )
                    best_match = SteamEntry(appid=int(appid), score=score, title=result)
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
    finally:
        await page.close()

    if best_match is None:
        logger.info(f"Steam: Search for {search_string} found no result.")

        return None

    logger.info(
        f"Steam: Search for {search_string} resulted in {best_match.title} ({best_match.appid}) as the best match with a score of {(best_match.score*100):.0f} %."
    )
    return best_match.appid


async def get_steam_details(
    context: BrowserContext,
    id_: int | None = None,
    title: str | None = None,
) -> SteamInfo | None:
    steam_app_id: int | None = None

    if id_:
        steam_app_id = id_
    elif title:
        steam_app_id = await get_steam_id(title, context=context)

    if not steam_app_id:
        # No entry found, not adding any data
        return None

    logger.info(f"Reading Steam details for app id {steam_app_id}.")

    steam_info = SteamInfo(
        id=steam_app_id,
        url=STEAM_DETAILS_STORE_URL + str(steam_app_id),
    )

    await add_data_from_steam_api(steam_info)
    await add_data_from_steam_store_page(steam_info, context=context)

    return steam_info


async def add_data_from_steam_api(steam_info: SteamInfo) -> None:
    data = await read_from_steam_api(steam_info.id)
    if data is None:
        return

    app_id = list(data.keys())[0]
    content = data[app_id]["data"]

    try:
        steam_info.name = content["name"]
    except KeyError:
        pass

    try:
        steam_info.short_description = content["short_description"]
    except KeyError:
        pass

    try:
        genres: list[str] = []
        for genre in content["genres"]:
            genres.append(genre["description"])
        steam_info.genres = ", ".join(genres)
    except KeyError:
        pass

    try:
        date_string = content["release_date"]["date"]
        timestamp = datetime.strptime(date_string, "%d %b, %Y")
        steam_info.release_date = timestamp.replace(tzinfo=timezone.utc)
    except (KeyError, ValueError):
        pass

    try:
        # We do not save prices in any other currency than EUR (or free)
        recommended_price_value: int = content["price_overview"]["initial"]
        if (
            recommended_price_value == 0
            or content["price_overview"]["currency"] == "EUR"
        ):
            steam_info.recommended_price_eur = recommended_price_value / 100
    except (KeyError, ValueError):
        pass

    try:
        steam_info.recommendations = content["recommendations"]["total"]
    except KeyError:
        pass

    try:
        steam_info.metacritic_score = content["metacritic"]["score"]
    except KeyError:
        pass

    try:
        steam_info.metacritic_url = content["metacritic"]["url"].replace(R"\/", "/")
    except KeyError:
        pass

    try:
        # Prefer header image over first screenshot
        steam_info.image_url = content["screenshots"][0]["path_full"].replace(
            R"\/", "/"
        )
        steam_info.image_url = content["header_image"].replace(R"\/", "/")
    except KeyError:
        pass

    try:
        steam_info.publishers = ", ".join(content["publishers"])
    except KeyError:
        pass


async def read_from_steam_api(steam_app_id: int) -> dict[str, Any] | None:
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(STEAM_DETAILS_JSON_URL + str(steam_app_id))
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.warning(
                f"Couldn't get details for {steam_app_id} from Steam JSON API ({e})."
            )
            return None


async def add_data_from_steam_store_page(
    steam_info: SteamInfo,
    *,
    context: BrowserContext,
) -> None:
    page = await context.new_page()
    # TODO: Put this in a try/finally block and make it reusable (see get_steam_id method)
    await page.goto(steam_info.url)

    try:
        await page.wait_for_selector(STEAM_DETAILS_LOADED)
    except Error:
        logger.error(f"Steam store page for {steam_info.id} didn't load.")
        return None

    try:
        await skip_age_verification(page)
    except Error:
        logger.error(f"Steam age verification for {steam_info.id} failed.")
        return None

    # Add the review score percentage if available
    if steam_info.percent is None:
        try:
            review_score_percent = (
                await page.locator("#userReviews")
                .locator('div[itemprop="aggregateRating"]')
                .get_attribute("data-tooltip-html")
            )
            if review_score_percent is None:
                logger.warning(f"No Steam percentage found for {steam_info.id}.")
            elif review_score_percent.startswith("Need more user reviews"):
                # No percentage, but this reason is fine
                pass
            else:
                steam_info.percent = int(review_score_percent.split("%")[0].strip())
        except Error:
            logger.warning(f"No Steam percentage found for {steam_info.id}.")
        except ValueError as e:
            logger.error(f"Invalid Steam percentage for {steam_info.id} ({str(e)}).")

    # Add the review score if available
    if steam_info.score is None:
        try:
            review_score = await page.locator(
                STEAM_DETAILS_REVIEW_SCORE_VALUE
            ).get_attribute("content")
            if review_score is None:
                logger.warning(f"No Steam rating found for {steam_info.id}.")
            else:
                steam_info.score = int(review_score)
        except Error:
            logger.warning(f"No Steam rating found for {steam_info.id}!")
        except ValueError as e:
            logger.error(f"Invalid Steam rating for {steam_info.id} ({str(e)}).")

    # Add the number of recommendations if available
    if steam_info.recommendations is None:
        try:
            recommendations = await page.locator(
                STEAM_DETAILS_REVIEW_COUNT
            ).get_attribute("content")
            if recommendations is None:
                logger.warning(f"No Steam rating found for {steam_info.id}.")
            else:
                steam_info.recommendations = int(recommendations)
        except Error:
            logger.warning(f"No Steam rating found for {steam_info.id}!")
        except ValueError as e:
            logger.error(f"Invalid Steam rating for {steam_info.id} ({str(e)}).")

    # First source to add the recommended price if available
    if steam_info.recommended_price_eur is None:
        try:
            recommended_price = await page.locator(
                STEAM_PRICE_DISCOUNTED_ORIGINAL
            ).text_content()
            if recommended_price is None:
                logger.info(
                    f"No Steam original price found on shop page for {steam_info.id}."
                )
            else:
                steam_info.recommended_price_eur = float(
                    recommended_price.replace("€", "").replace(",", ".").strip()
                )
        except Error:
            logger.info(
                f"No Steam original price found on shop page for {steam_info.id}."
            )
        except ValueError as e:
            logger.error(
                f"Steam original price has wrong format for {steam_info.id} ({str(e)})."
            )

    # Second source to add the recommended price if available
    if steam_info.recommended_price_eur is None:
        try:
            recommended_price = await page.locator(STEAM_PRICE_FULL).text_content()
            if recommended_price is None:
                logger.info(
                    f"No Steam recommended price found on shop page for {steam_info.id}."
                )
            elif "free" in recommended_price.lower():
                steam_info.recommended_price_eur = 0
            else:
                steam_info.recommended_price_eur = float(
                    recommended_price.replace("€", "").replace(",", ".").strip()
                )
        except Error:
            logger.error(
                f"No Steam recommended price found on shop page for {steam_info.id}."
            )
        except ValueError as e:
            logger.error(
                f"Steam recommended price has wrong format for {steam_info.id} ({str(e)})."
            )

    # Add the release date if available
    if steam_info.release_date is None:
        try:
            release_date_str = await page.locator(STEAM_RELEASE_DATE).text_content()
            if release_date_str is None:
                logger.debug(f"No release date found on shop page for {steam_info.id}")
            else:
                release_date_str = release_date_str.split("RELEASE DATE:")[1].strip()
                release_date = datetime.strptime(release_date_str, "%d %b, %Y").replace(
                    tzinfo=timezone.utc
                )
                steam_info.release_date = release_date

        except Error:
            logger.debug(f"No release date found on shop page for {steam_info.id}.")
        except (IndexError, ValueError) as e:
            logger.error(
                f"Release date in wrong format on shop page for {steam_info.id} ({str(e)})."
            )


async def skip_age_verification(page: Page) -> None:
    """
    For some games an age verification is needed. Skip this to see the
    interesting parts. We do this by entering the static date of 12 July 1990,
    then click the button to continue.
    """
    if "agecheck" in page.url:
        await page.select_option("#ageDay", "12")
        await page.select_option("#ageMonth", "March")
        await page.select_option("#ageYear", "1990")
        await page.click("#view_product_page_btn")

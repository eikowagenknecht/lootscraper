import logging
import urllib.parse
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import httpx
from playwright.async_api import BrowserContext, Error, Page

from app.browser import get_new_page
from app.database import SteamInfo
from app.scraper.info.utils import RESULT_MATCH_THRESHOLD, get_match_score

logger = logging.getLogger(__name__)

STEAM_SEARCH_URL = "https://store.steampowered.com/search/"
STEAM_DETAILS_JSON_URL = "https://store.steampowered.com/api/appdetails"
STEAM_DETAILS_STORE_URL = "https://store.steampowered.com/app/"


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
    The comparison is done with difflib, lower cased. Only matches with a score
    of at least 75 % are returned.
    """

    logger.info(f"Getting id for {search_string}.")

    params = {
        "term": search_string,
        "category1": 998,  # Games
    }
    url = f"{STEAM_SEARCH_URL}?{urllib.parse.urlencode(params)}"

    async with get_new_page(context) as page:
        await page.goto(url)

        elements = (
            page.locator("#search_result_container")
            .locator("a")
            .filter(has=page.locator(".title"))
        )

        no_res = await elements.count()
        best_match: SteamEntry | None = None

        for i in range(no_res):
            element = elements.nth(i)
            try:
                title = await element.locator(".title").text_content()
                appid = await element.get_attribute("data-ds-appid")

                if not title or not appid:
                    raise ValueError("Result needs a title and appid.")

                score = get_match_score(search_string, title)

                if score >= RESULT_MATCH_THRESHOLD and (
                    best_match is None or score > best_match.score
                ):
                    logger.debug(
                        f"Found match {title} with a score of {(score*100):.0f} %."
                    )
                    best_match = SteamEntry(int(appid), score, title)
                else:
                    logger.debug(
                        f"Ignoring {title} as it's score of {(score*100):.0f} % is too low."
                    )
            except Error as e:
                # Log problem with reading a result, but continue with the next one
                logger.warning(str(e))
                continue
            except ValueError as e:
                # Log problem with reading a result, but continue with the next one
                logger.warning(str(e))
                continue

    if best_match is None:
        logger.info(f"Search for {search_string} found no result.")
        return None

    logger.info(
        f"{best_match.title} ({best_match.appid}) is the best match ({(best_match.score*100):.0f} %)."
    )
    return best_match.appid


async def get_steam_details(
    id_: int | None = None,
    title: str | None = None,
    *,
    context: BrowserContext,
) -> SteamInfo | None:
    steam_app_id: int | None = None

    if id_:
        steam_app_id = id_
    elif title:
        steam_app_id = await get_steam_id(title, context=context)

    if not steam_app_id:
        # No entry found
        return None

    logger.info(f"Reading Steam details for app id {steam_app_id}.")

    steam_info = SteamInfo(
        id=steam_app_id,
        url=STEAM_DETAILS_STORE_URL + str(steam_app_id),
    )

    await add_data_from_steam_api(steam_info)
    await add_data_from_steam_store_page(steam_info, context=context)

    # Name is mandatory
    if not steam_info.name:
        return None

    return steam_info


async def add_data_from_steam_api(steam_info: SteamInfo) -> None:
    data = await read_from_steam_api(steam_info.id)
    if data is None:
        return

    try:
        app_id = list(data.keys())[0]
        if data[app_id]["success"] == "false":
            logger.error(f"Could not read data for app id {steam_info.id}: {data}")
            return
        content = data[app_id]["data"]
    except KeyError:
        logger.error(f"Could not read data for app id {steam_info.id}: {data}")
        return

    try:
        steam_info.name = content["name"]
    except KeyError:
        logger.error(f"Could not read name for app id {steam_info.id}: {data}")

    try:
        steam_info.short_description = content["short_description"]
    except KeyError:
        logger.error(
            f"Could not read short description for app id {steam_info.id}: {data}"
        )

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
        if content["is_free"]:
            steam_info.recommended_price_eur = 0
    except KeyError:
        pass

    if steam_info.recommended_price_eur is None:
        try:
            # We do not save prices in any other currency than EUR (or free)
            recommended_price_value: int = content["price_overview"]["initial"]
            if recommended_price_value == 0:
                steam_info.recommended_price_eur = 0
            elif content["price_overview"]["currency"] != "EUR":
                logger.error(
                    f'Steam app id {steam_info.id} has a currency other than EUR ({content["price_overview"]["currency"]}).'
                )
            else:
                steam_info.recommended_price_eur = recommended_price_value / 100
        except (KeyError, ValueError) as e:
            # Sometimes games are not available for purchase on steam or
            # not released yet or only available as a bundle, so this might be
            # correct.
            logger.info(f"No price found for Steam app id {steam_info.id}: {e}")

    try:
        steam_info.recommendations = content["recommendations"]["total"]
    except KeyError:
        pass

    try:
        steam_info.metacritic_score = content["metacritic"]["score"]
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
    FILTERS = ",".join(
        [
            "basic",  # name, short_description, header_image, is_free
            "price_overview",
            "release_date",
            "genres",
            "recommendations",
            "publishers",
            "metacritic",
            "screenshots",
        ]
    )
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                STEAM_DETAILS_JSON_URL,
                params={
                    "appids": steam_app_id,
                    "filters": FILTERS,
                    "cc": "de",  # For prices
                    "l": "english",  # For descriptions
                },
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(
                f"Couldn't get details for {steam_app_id} from Steam JSON API: {e}."
            )
            return None


async def add_data_from_steam_store_page(
    steam_info: SteamInfo,
    *,
    context: BrowserContext,
) -> None:
    async with get_new_page(context) as page:
        await page.goto(steam_info.url)

        try:
            await page.wait_for_selector(".game_page_background")
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
                elif review_score_percent.startswith(
                    "Need more user reviews"
                ) or review_score_percent.startswith("No user reviews"):
                    # No percentage, but this reason is fine
                    pass
                else:
                    steam_info.percent = int(review_score_percent.split("%")[0].strip())
            except Error as e:
                logger.warning(f"No Steam percentage found for {steam_info.id}: {e}")
            except ValueError as e:
                logger.error(f"Invalid Steam percentage for {steam_info.id}: {e}")

        # Add the review score if available
        # If the percentage is not filled, there are no reviews, so skip in that case
        if steam_info.score is None and steam_info.percent is not None:
            try:
                review_score = await page.locator(
                    '#userReviews [itemprop="aggregateRating"] [itemprop="ratingValue"]'
                ).get_attribute("content")
                if review_score is None:
                    logger.warning(f"No Steam rating found for {steam_info.id}.")
                else:
                    steam_info.score = int(review_score)
            except Error as e:
                logger.warning(f"No Steam rating found for {steam_info.id}: {e}")
            except ValueError as e:
                logger.error(f"Invalid Steam rating for {steam_info.id}: {e}")

        # Add the number of recommendations if available
        # Should be filled from the API already, but just in case
        # If the percentage is not filled, there are no reviews, so skip in that case
        if steam_info.recommendations is None and steam_info.percent is not None:
            try:
                recommendations = await page.locator(
                    '#userReviews [itemprop="aggregateRating"] [itemprop="reviewCount"]'
                ).get_attribute("content")
                if recommendations is None:
                    logger.warning(f"No rating found for {steam_info.id}.")
                else:
                    steam_info.recommendations = int(recommendations)
            except Error as e:
                logger.warning(f"No rating found for {steam_info.id}: {e}")
            except ValueError as e:
                logger.error(f"Invalid rating for {steam_info.id}: {e}")

        # This currently would also get the price from the first bundle which is
        # incorrect. Commented out for now because the API seems to be more reliable.
        #
        # # Add the original price if available
        # # Should be filled from the API already, but just in case
        # if steam_info.recommended_price_eur is None:
        #     try:
        #         recommended_price = (
        #             await page.locator(".game_area_purchase_game")
        #             .filter(has=page.locator(".platform_img"))
        #             .filter(has_text="Add to Cart")
        #             .first.locator(".game_purchase_action .discount_original_price")
        #             .text_content(timeout=1000)
        #         )
        #         if recommended_price is None:
        #             logger.info(
        #                 f"No original price found on shop page for {steam_info.id}."
        #             )
        #         else:
        #             steam_info.recommended_price_eur = float(
        #                 recommended_price.replace("€", "").replace(",", ".").strip()
        #             )
        #     except Error as e:
        #         logger.info(
        #             f"No original price found on shop page for {steam_info.id}: {e}"
        #         )
        #     except ValueError as e:
        #         logger.error(
        #             f"Original price has wrong format for {steam_info.id}: {e}"
        #         )

        # # Source when the game is not discounted
        # # Should be filled from the API already, but just in case
        # if steam_info.recommended_price_eur is None:
        #     try:
        #         recommended_price = (
        #             await page.locator(".game_area_purchase_game")
        #             .filter(has=page.locator(".platform_img"))
        #             .filter(has_text="Add to Cart")
        #             .first.locator(".game_purchase_action .game_purchase_price")
        #             .text_content(timeout=1000)
        #         )
        #         if recommended_price is None:
        #             logger.info(
        #                 f"No recommended price found on shop page for {steam_info.id}."
        #             )
        #         elif "free" in recommended_price.lower():
        #             steam_info.recommended_price_eur = 0
        #         else:
        #             steam_info.recommended_price_eur = float(
        #                 recommended_price.replace("€", "").replace(",", ".").strip()
        #             )
        #     except Error as e:
        #         logger.info(
        #             f"No recommended price found on shop page for {steam_info.id}: {e}"
        #         )
        #     except ValueError as e:
        #         logger.error(
        #             f"Recommended price has wrong format for {steam_info.id}: {e}"
        #         )

        # # If there is a "Free game" button, the game is free
        # # Should be filled from the API already, but just in case
        # if steam_info.recommended_price_eur is None:
        #     try:
        #         free_games_button = await page.locator("#freeGameBtn").is_visible(
        #             timeout=1000
        #         )
        #         if free_games_button:
        #             steam_info.recommended_price_eur = 0
        #     except Error as e:
        #         logger.debug(f"Game {steam_info.id} is not free: {e}")

        # Add the release date if available
        # Should be filled from the API already, but just in case
        if steam_info.release_date is None:
            try:
                release_date_str = await page.locator(
                    "#genresAndManufacturer"
                ).text_content()
                if release_date_str is None:
                    logger.debug(
                        f"No release date found on shop page for {steam_info.id}"
                    )
                else:
                    release_date_str = release_date_str.split("Release Date:")[
                        1
                    ].strip()
                    if release_date_str == "Coming soon":
                        # That's fine, we'll just leave it empty
                        pass
                    else:
                        release_date = datetime.strptime(
                            release_date_str, "%d %b, %Y"
                        ).replace(tzinfo=timezone.utc)
                        steam_info.release_date = release_date
            except Error as e:
                logger.debug(
                    f"No release date found on shop page for {steam_info.id}: {e}"
                )
            except (IndexError, ValueError) as e:
                logger.error(
                    f"Release date in wrong format on shop page for {steam_info.id}: {e}"
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

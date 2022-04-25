# type: ignore
import logging
import unittest

from selenium.webdriver.chrome.webdriver import WebDriver
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common import TIMESTAMP_LONG
from app.configparser import Config
from app.pagedriver import get_pagedriver
from app.scraper.info.igdb import get_igdb_id
from app.scraper.info.steam import get_steam_details, get_steam_id
from app.scraper.info.utils import get_match_score
from app.sqlalchemy import LootDatabase, Offer, User
from app.telegram import TelegramBot

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)-5s] %(message)s",
    datefmt=TIMESTAMP_LONG,
)


class VariousTests(unittest.TestCase):
    def test_entity_framework(self) -> None:
        with LootDatabase(echo=True) as db:
            db.initialize_or_update()
            self.assertTrue(True)

    def test_telegram(self) -> None:
        with LootDatabase(echo=True) as db:
            # Arrange
            # Act
            with TelegramBot(Config.get(), db.session) as bot:
                bot.updater.idle()
            # Assert

    def test_telegram_messagesend_registered_user(self) -> None:
        with (
            LootDatabase(echo=True) as db,
            TelegramBot(Config.get(), db.session) as bot,
        ):
            # Arrange
            session: Session = db.session

            # Act
            offer: Offer = session.execute(select(Offer)).scalars().first()
            user: User = (
                session.execute(
                    select(User).where(User.telegram_id == 724039662)
                )  # Eiko
                .scalars()
                .first()
            )

            message = bot.send_offer(offer, user)

            # Assert
            self.assertTrue(message)

    def test_telegram_messagesend_unregistered_user(self) -> None:
        with (
            LootDatabase(echo=True) as db,
            TelegramBot(Config.get(), db.session) as bot,
        ):
            # Arrange
            session: Session = db.session

            # Act
            offer: Offer = session.execute(select(Offer)).scalars().first()
            user: User = (
                session.execute(
                    select(User).where(User.telegram_id == 99921143)
                )  # Martin
                .scalars()
                .first()
            )

            message = bot.send_offer(offer, user)

            # Assert
            self.assertFalse(message)

    def test_telegram_new_offers(self) -> None:
        with (
            LootDatabase(echo=True) as db,
            TelegramBot(Config.get(), db.session) as bot,
        ):
            # Arrange
            session: Session = db.session

            # Act
            user: User = (
                session.execute(select(User).where(User.telegram_id == 724039662))
                .scalars()
                .first()
            )
            bot.send_new_offers(user)

            # Assert

    def test_similarity(self) -> None:
        search = "Rainbow Six Siege"
        result = "Tom Clancy's Rainbow Six® Siege"

        score = get_match_score(search, result)
        self.assertEquals(score, 0.99)

        search = "Fall Guys"
        result = "Fall Guy"

        score = get_match_score(search, result)
        self.assertLess(score, 0.99)

    def test_pagedriver(self) -> None:
        driver = get_pagedriver()
        self.assertIsNotNone(driver)

    def test_steam_appid_resolution(self) -> None:
        driver: WebDriver
        with get_pagedriver() as driver:
            expected_id: int = 359550  # Tom Clancy's Rainbow Six® Siege
            scraped_id: int = get_steam_id(driver, "Rainbow Six Siege")
            self.assertEquals(expected_id, scraped_id)

    def test_steam_appid_resolution_with_special_chars(self) -> None:
        driver: WebDriver
        with get_pagedriver() as driver:
            expected_id: int = 32460
            scraped_id: int = get_steam_id(
                driver, "Monkey Island 2 Special Edition: LeChuck’s Revenge"
            )
            self.assertEquals(expected_id, scraped_id)

    def test_igdb_id_resolution_with_special_chars(self) -> None:
        searchstring = "Monkey Island 2 Special Edition: LeChuck’s Revenge"
        expected_id: int = 66
        scraped_id: int = get_igdb_id(searchstring)
        self.assertEquals(expected_id, scraped_id)

    def test_steam_appinfo(self) -> None:
        driver: WebDriver
        with get_pagedriver() as driver:
            steam_info = get_steam_details(driver, title="Counter-Strike")
            self.assertIsNotNone(steam_info)
            self.assertEquals(steam_info.name, "Counter-Strike")
            self.assertIsNotNone(steam_info.short_description)
            self.assertEquals(
                steam_info.release_date.isoformat(), "2000-11-01T00:00:00+00:00"
            )
            self.assertEquals(steam_info.recommended_price_eur, 8.19)
            self.assertEquals(steam_info.genres, "Action")

            self.assertGreater(steam_info.recommendations, 100000)
            self.assertEquals(steam_info.percent, 96)
            self.assertEquals(steam_info.score, 10)
            self.assertEquals(steam_info.metacritic_score, 88)
            self.assertEquals(
                steam_info.metacritic_url,
                """https://www.metacritic.com/game/pc/counter-strike?ftag=MCD-06-10aaa1f""",
            )

    def test_steam_appinfo2(self) -> None:
        driver: WebDriver
        with get_pagedriver() as driver:
            steam_info = get_steam_details(driver, title="Rainbow Six Siege")
            self.assertIsNotNone(steam_info)
            self.assertEquals(steam_info.name, "Tom Clancy's Rainbow Six® Siege")
            self.assertIsNotNone(steam_info.short_description)
            self.assertEquals(
                steam_info.release_date.isoformat(), "2015-12-01T00:00:00+00:00"
            )
            self.assertEquals(steam_info.recommended_price_eur, 19.99)
            self.assertEquals(steam_info.genres, "Action")

            self.assertGreater(steam_info.recommendations, 850000)
            self.assertEquals(steam_info.percent, 87)
            self.assertEquals(steam_info.score, 9)
            self.assertEquals(steam_info.metacritic_score, None)
            self.assertEquals(steam_info.metacritic_url, None)

    def test_steam_appinfo_releasedate(self) -> None:
        driver: WebDriver
        with get_pagedriver() as driver:
            steam_info = get_steam_details(driver, title="Guild Wars 2")
            self.assertIsNotNone(steam_info)
            self.assertEquals(steam_info.name, "Guild Wars 2")
            self.assertIsNotNone(steam_info.release_date)
            self.assertEquals(
                steam_info.release_date.isoformat(), "2012-08-28T00:00:00+00:00"
            )

    def test_steam_appinfo_recommendations(self) -> None:
        driver: WebDriver
        with get_pagedriver() as driver:
            steam_info = get_steam_details(driver, title="Riverbond")
            self.assertIsNotNone(steam_info)
            self.assertEquals(steam_info.name, "Riverbond")
            self.assertIsNotNone(steam_info.recommendations)

    # This is a weird one where the price is shown in "KWR" in the JSON, so the
    # store page has to be used instead to get the price in EUR
    def test_steam_appinfo_price(self) -> None:
        driver: WebDriver
        with get_pagedriver() as driver:
            steam_info = get_steam_details(driver, title="Cities: Skylines")
            self.assertIsNotNone(steam_info)
            self.assertEquals(steam_info.name, "Cities: Skylines")
            self.assertEquals(steam_info.recommended_price_eur, 27.99)

    def test_steam_appinfo_language(self) -> None:
        driver: WebDriver
        with get_pagedriver() as driver:
            steam_info = get_steam_details(driver, title="Warframe")
            self.assertIsNotNone(steam_info)
            self.assertEquals(steam_info.name, "Warframe")
            self.assertEquals(steam_info.short_description[0:6], "Awaken")

    def test_steam_appinfo_ageverify(self) -> None:
        driver: WebDriver
        with get_pagedriver() as driver:
            steam_info = get_steam_details(driver, title="Doom Eternal")
            self.assertIsNotNone(steam_info)
            self.assertEquals(steam_info.name, "DOOM Eternal")
            self.assertEquals(steam_info.score, 9)

    def test_steam_json_multiple_genres(self) -> None:
        with get_pagedriver() as driver:
            steam_info = get_steam_details(driver, id=1424910)
            self.assertIsNotNone(steam_info)
            self.assertEquals(steam_info.genres, "Action, Indie, Racing, Early Access")

    def test_igdb_id(self) -> None:
        id = get_igdb_id("Cities: Skylines")
        self.assertEquals(id, 9066)

    # def test_igdb_details(self) -> None:
    #     game = add_igdb_details("Cities: Skylines")
    #     self.assertEquals(game.name, "Cities: Skylines")
    #     self.assertIsNotNone(game.release_date)
    #     self.assertEquals(game.release_date.isoformat(), "2015-03-10T00:00:00+00:00")


if __name__ == "__main__":
    unittest.main()

# type: ignore
import logging
import unittest

import sqlalchemy as sa
from sqlalchemy import orm

from app.common import TIMESTAMP_LONG
from app.configparser import Config
from app.discordbot import DiscordBot
from app.pagedriver import get_pagedriver
from app.scraper.info.igdb import get_igdb_details, get_igdb_id
from app.scraper.info.steam import get_steam_details, get_steam_id
from app.scraper.info.utils import get_match_score
from app.sqlalchemy import LootDatabase, Offer, User
from app.telegram import TelegramBot

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)-5s] %(message)s",
    datefmt=TIMESTAMP_LONG,
)


class DiscordBotTests(unittest.TestCase):
    def test_discord_bot(self) -> None:
        with (
            LootDatabase(echo=True) as db,
            DiscordBot(Config.get(), db.Session) as bot,
        ):
            pass


class VariousTests(unittest.TestCase):
    def test_entity_framework(self) -> None:
        with LootDatabase(echo=True) as db:
            db.initialize_or_update()


class TelegramTests(unittest.TestCase):
    @unittest.skip("This test doesn't end and is for manual execution only")
    def test_run_bot_in_idle(self) -> None:
        # Arrange
        with (
            LootDatabase(echo=True) as db,
            TelegramBot(Config.get(), db.Session) as bot,
        ):
            # Act
            bot.updater.idle()
            # Assert

    def test_telegram_messagesend_registered_user(self) -> None:
        # Arrange
        with (
            LootDatabase(echo=True) as db,
            TelegramBot(Config.get(), db.Session) as bot,
        ):
            session: orm.Session = db.Session()

            # Act
            offer: Offer = session.execute(sa.select(Offer)).scalars().first()
            user: User = (
                session.execute(
                    sa.select(User).where(User.telegram_id == 724039662)
                )  # Eiko
                .scalars()
                .first()
            )

            message = bot.send_offer(offer, user)

            # Assert
            self.assertTrue(message)

    def test_telegram_new_offers(self) -> None:
        # Arrange
        with (
            LootDatabase(echo=True) as db,
            TelegramBot(Config.get(), db.Session) as bot,
        ):
            session: orm.Session = db.Session()

            # Act
            user: User = (
                session.execute(sa.select(User).where(User.telegram_id == 724039662))
                .scalars()
                .first()
            )
            bot.send_new_offers(user)

            # Assert

    def test_telegram_flooding(self) -> None:
        # Arrange
        with (
            LootDatabase(echo=True) as db,
            TelegramBot(Config.get(), db.Session) as bot,
        ):
            for i in range(300):
                # Act
                result = bot.send_message(724039662, f"Flooding Test message {i}")
                # Assert
                self.assertIsNotNone(result)


class LocalTests(unittest.TestCase):
    def test_similarity_1(self) -> None:
        search = "Rainbow Six Siege"
        result = "Tom Clancy's Rainbow Six® Siege"

        score = get_match_score(search, result)
        self.assertEqual(score, 0.99)

    def test_similarity_2(self) -> None:
        search = "Fall Guys"
        result = "Fall Guy"

        score = get_match_score(search, result)
        self.assertLess(score, 0.99)


class ScraperTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.driver = get_pagedriver()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.driver.quit()

    def test_pagedriver(self) -> None:
        self.assertIsNotNone(self.driver)

    def test_steam_appid_resolution(self) -> None:
        expected_id: int = 359550  # Tom Clancy's Rainbow Six® Siege
        scraped_id: int = get_steam_id("Rainbow Six Siege", driver=self.driver)
        self.assertEqual(expected_id, scraped_id)

    def test_steam_appid_resolution_with_special_chars(self) -> None:
        expected_id: int = 32460
        scraped_id: int = get_steam_id(
            "Monkey Island 2 Special Edition: LeChuck’s Revenge", driver=self.driver
        )
        self.assertEqual(expected_id, scraped_id)

    def test_steam_appinfo(self) -> None:
        steam_info = get_steam_details(self.driver, title="Counter-Strike")
        self.assertIsNotNone(steam_info)
        self.assertEqual(steam_info.name, "Counter-Strike")
        self.assertIsNotNone(steam_info.short_description)
        self.assertEqual(
            steam_info.release_date.isoformat(), "2000-11-01T00:00:00+00:00"
        )
        self.assertEqual(steam_info.recommended_price_eur, 8.19)
        self.assertEqual(steam_info.genres, "Action")

        self.assertGreater(steam_info.recommendations, 100000)
        self.assertEqual(steam_info.percent, 96)
        self.assertEqual(steam_info.score, 10)
        self.assertEqual(steam_info.metacritic_score, 88)
        self.assertEqual(
            steam_info.metacritic_url,
            """https://www.metacritic.com/game/pc/counter-strike?ftag=MCD-06-10aaa1f""",
        )

    def test_steam_appinfo2(self) -> None:
        steam_info = get_steam_details(title="Rainbow Six Siege", driver=self.driver)
        self.assertIsNotNone(steam_info)
        self.assertEqual(steam_info.name, "Tom Clancy's Rainbow Six® Siege")
        self.assertIsNotNone(steam_info.short_description)
        self.assertEqual(
            steam_info.release_date.isoformat(), "2015-12-01T00:00:00+00:00"
        )
        self.assertEqual(steam_info.recommended_price_eur, 19.99)
        self.assertEqual(steam_info.genres, "Action")

        self.assertGreater(steam_info.recommendations, 850000)
        self.assertEqual(steam_info.percent, 87)
        self.assertEqual(steam_info.score, 9)
        self.assertEqual(steam_info.metacritic_score, None)
        self.assertEqual(steam_info.metacritic_url, None)

    def test_steam_appinfo_releasedate(self) -> None:
        steam_info = get_steam_details(title="Riverbond", driver=self.driver)
        self.assertIsNotNone(steam_info)
        self.assertEqual(steam_info.name, "Riverbond")
        self.assertIsNotNone(steam_info.release_date)
        self.assertEqual(
            steam_info.release_date.isoformat(), "2019-06-09T00:00:00+00:00"
        )

    def test_steam_appinfo_recommendations(self) -> None:
        steam_info = get_steam_details(title="Riverbond", driver=self.driver)
        self.assertIsNotNone(steam_info)
        self.assertEqual(steam_info.name, "Riverbond")
        self.assertIsNotNone(steam_info.recommendations)

    # This is a weird one where the price is shown in "KWR" in the JSON, so the
    # store page has to be used instead to get the price in EUR
    def test_steam_appinfo_price(self) -> None:
        steam_info = get_steam_details(title="Cities: Skylines", driver=self.driver)
        self.assertIsNotNone(steam_info)
        self.assertEqual(steam_info.name, "Cities: Skylines")
        self.assertEqual(steam_info.recommended_price_eur, 27.99)

    def test_steam_appinfo_language(self) -> None:
        steam_info = get_steam_details(title="Warframe", driver=self.driver)
        self.assertIsNotNone(steam_info)
        self.assertEqual(steam_info.name, "Warframe")
        self.assertEqual(steam_info.short_description[0:6], "Awaken")

    def test_steam_appinfo_ageverify(self) -> None:
        steam_info = get_steam_details(title="Doom Eternal", driver=self.driver)
        self.assertIsNotNone(steam_info)
        self.assertEqual(steam_info.name, "DOOM Eternal")
        self.assertEqual(
            steam_info.release_date.isoformat(), "2020-03-19T00:00:00+00:00"
        )

    def test_steam_json_multiple_genres(self) -> None:
        steam_info = get_steam_details(id_=1424910, driver=self.driver)
        self.assertIsNotNone(steam_info)
        self.assertEqual(steam_info.genres, "Action, Indie, Racing, Early Access")


class ApiTests(unittest.TestCase):
    def test_igdb_id(self) -> None:
        id_ = get_igdb_id("Cities: Skylines")
        self.assertEqual(id_, 9066)

    def test_igdb_id_resolution_with_special_chars(self) -> None:
        searchstring = "Monkey Island 2 Special Edition: LeChuck’s Revenge"
        expected_id: int = 66
        scraped_id: int = get_igdb_id(searchstring)
        self.assertEqual(expected_id, scraped_id)

    def test_igdb_details(self) -> None:
        game = get_igdb_details(title="Cities: Skylines")
        self.assertEqual(game.name, "Cities: Skylines")
        self.assertIsNotNone(game.release_date)
        self.assertEqual(game.release_date.isoformat(), "2015-03-10T00:00:00+00:00")


if __name__ == "__main__":
    unittest.main()

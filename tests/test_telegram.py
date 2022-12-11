# type: ignore
import logging
import unittest

import sqlalchemy as sa
from sqlalchemy import orm

from app.common import TIMESTAMP_LONG
from app.configparser import Config
from app.sqlalchemy import LootDatabase, Offer, User
from app.telegram import TelegramBot

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)-5s] %(message)s",
    datefmt=TIMESTAMP_LONG,
)


class TelegramTests(unittest.IsolatedAsyncioTestCase):
    @unittest.skip("This test doesn't end and is for manual execution only")
    async def test_run_bot_in_idle(self) -> None:
        # Arrange
        with LootDatabase(echo=True) as db:
            async with TelegramBot(Config.get(), db.Session):
                # Act
                pass
                # bot.updater.idle()
                # Assert

    async def test_telegram_messagesend_registered_user(self) -> None:
        # Arrange
        with LootDatabase(echo=True) as db:
            async with TelegramBot(Config.get(), db.Session) as bot:
                session: orm.Session = db.Session()

                # Act
                # TODO: Replace with mock offer
                offer: Offer = session.execute(sa.select(Offer)).scalars().first()
                user: User = (
                    session.execute(
                        sa.select(User).where(User.telegram_id == 724039662)
                    )  # Eiko
                    .scalars()
                    .first()
                )

                message = await bot.send_offer(offer, user)

                # Assert
                self.assertTrue(message)

    async def test_telegram_new_offers(self) -> None:
        # Arrange
        with LootDatabase(echo=True) as db:
            async with TelegramBot(Config.get(), db.Session) as bot:
                session: orm.Session = db.Session()

                # Act
                user: User = (
                    session.execute(
                        sa.select(User).where(User.telegram_id == 724039662)
                    )
                    .scalars()
                    .first()
                )
                await bot.send_new_offers(user)

                # Assert

    async def test_telegram_flooding(self) -> None:
        # Arrange
        with LootDatabase(echo=True) as db:
            async with TelegramBot(Config.get(), db.Session) as bot:
                for i in range(300):
                    # Act
                    result = await bot.send_message(
                        724039662, f"Flooding Test message {i}"
                    )
                    # Assert
                    self.assertIsNotNone(result)


if __name__ == "__main__":
    unittest.main()

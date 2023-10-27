# type: ignore
from __future__ import annotations

import asyncio
import unittest

import sqlalchemy as sa
from lootscraper.config import Config
from lootscraper.database import LootDatabase, Offer, TelegramChat
from lootscraper.telegrambot import TelegramBot
from sqlalchemy import orm


class TelegramTests(unittest.IsolatedAsyncioTestCase):
    @unittest.skip("This test doesn't end and is for manual execution only.")
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
                user: TelegramChat = (
                    session.execute(
                        sa.select(TelegramChat).where(
                            TelegramChat.user_id == 724039662,
                        ),
                    )  # Eiko
                    .scalars()
                    .first()
                )

                message = await bot.send_offer(offer, user)

                # Assert
                assert message

    async def test_telegram_new_offers(self) -> None:
        # Arrange
        with LootDatabase(echo=True) as db:
            async with TelegramBot(Config.get(), db.Session) as bot:
                session: orm.Session = db.Session()

                # Act
                user: TelegramChat = (
                    session.execute(
                        sa.select(TelegramChat).where(
                            TelegramChat.user_id == 724039662,
                        ),
                    )
                    .scalars()
                    .first()
                )
                await bot.send_new_offers(user)

                # Assert

    async def test_user_flooding(self) -> None:
        # Arrange
        with LootDatabase(echo=True) as db:
            async with TelegramBot(Config.get(), db.Session) as bot:
                await self.send_n_messages(bot, 724039662, 100)

    async def test_group_flooding(self) -> None:
        # Arrange
        with LootDatabase(echo=True) as db:
            async with TelegramBot(Config.get(), db.Session) as bot:
                await self.send_n_messages(bot, -738298064, 20)

    async def test_simultaneous_flooding(self) -> None:
        # Arrange
        with LootDatabase(echo=True) as db:
            async with TelegramBot(Config.get(), db.Session) as bot:
                await asyncio.gather(
                    self.send_n_messages(bot, 724039662, 100),
                    self.send_n_messages(bot, -738298064, 20),
                )

    async def send_n_messages(
        self,
        bot: TelegramBot,
        user: int,
        nr: int,
    ) -> None:
        for i in range(nr):
            result = await bot.send_message(user, f"Flooding Test message {i}")
            if result is None:
                raise ValueError("Message not sent.")


if __name__ == "__main__":
    unittest.main()

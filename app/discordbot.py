from __future__ import annotations

import logging
from types import TracebackType
from typing import Type

import discord
from sqlalchemy import orm

from app.configparser import ParsedConfig

logger = logging.getLogger(__name__)


class DiscordBot:
    def __init__(self, config: ParsedConfig, session: orm.Session):
        self.config = config
        self.Session = session

    def __enter__(self) -> DiscordBot:
        if self.config.discord_bot:
            self.start()
        return self

    def __exit__(
        self,
        exc_type: Type[BaseException] | None,
        exc_value: BaseException | None,
        traceback_: TracebackType | None,
    ) -> None:
        # TODO: Shutdown bot
        pass

    def start(self) -> None:
        """Start the bot."""

        intents = discord.Intents.default()
        intents.message_content = True  # pylint: disable=assigning-non-slot
        client = discord.Client(intents=intents)

        @client.event
        async def on_ready() -> None:
            logger.info(f"Discord Bot logged in as {client.user}.")

        @client.event
        async def on_message(message: discord.Message) -> None:
            if message.author == client.user:
                return

            if message.content.startswith("$hello"):
                await message.channel.send("Hello!")

        client.run(token=self.config.discord_access_token)

    def stop(self) -> None:
        """Stop the bot."""

        logger.info("Discord Bot: Stopping")
        # TODO: Stop bot

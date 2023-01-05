from __future__ import annotations

import asyncio
import json
import logging
import traceback
from datetime import datetime, timedelta, timezone
from http.client import RemoteDisconnected
from types import TracebackType
from typing import Any, Type

import humanize
import sqlalchemy as sa
import telegram
from sqlalchemy import orm
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Message, Update
from telegram.error import TelegramError
from telegram.ext import (
    AIORateLimiter,
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

from lootscraper.common import (
    TIMESTAMP_READABLE_WITH_HOUR,
    TIMESTAMP_SHORT,
    Channel,
    OfferDuration,
    OfferType,
    Source,
    chunkstring,
    markdown_bold,
    markdown_escape,
    markdown_url,
)
from lootscraper.config import Config, ParsedConfig, TelegramLogLevel
from lootscraper.database import Announcement, Game, Offer, TelegramSubscription, User
from lootscraper.scraper.loot.scraperhelper import get_all_scrapers

BUTTON_SHOW_DETAILS = "Details"
BUTTON_HIDE_DETAILS = "Summary"
BUTTON_CLAIM = "Claim"
BUTTON_DISMISS = "Dismiss"
BUTTON_CLOSE = "Close"

POPUP_SUBSCRIBED = "You are now subscribed."
POPUP_UNSUBSCRIBED = "You are now unsubscribed."

MESSAGE_MANAGE_MENU = (
    "Here you can manage your subscriptions. "
    "To do so, just click the following buttons to subscribe / unsubscribe. "
)
MESSAGE_DISMISSED = "Dismissed (can't delete messages older than 48h)."
MESSAGE_MANAGE_MENU_CLOSED = (
    "Thank you for managing your subscriptions. "
    "Forgot something? "
    "You can continue any time with /manage."
)
MESSAGE_TIMEZONE_MENU_CLOSED = (
    "Thank you for choosing your timezone. "
    "If you live in a place with daylight saving time, please remember to do this again at the appropriate time of year. "
)
MESSAGE_HELP = markdown_bold("Available commands") + markdown_escape(
    "\n/start - Start the bot (you already did that)"
    "\n/help - Show this help message"
    "\n/status - Show information about your subscriptions"
    "\n/manage - Manage your subscriptions"
    "\n/timezone - Choose a timezone that will be used to display the start and end dates"
    "\n/leave - Leave this bot and delete stored user data"
)
MESSAGE_UNKNOWN_COMMAND = (
    "Sorry, I didn't understand that command. Type /help to see all commands."
)
MESSAGE_USER_NOT_REGISTERED = (
    "You are not registered. Please, register with /start command."
)
MESSAGE_NO_SUBSCRIPTIONS = "You have no subscriptions. Change that with /manage."
MESSAGE_NO_NEW_OFFERS = (
    "No new offers available. I will write you as soon as they come in, I promise!"
)

logger = logging.getLogger(__name__)


class TelegramBot:
    def __init__(self, config: ParsedConfig, session: orm.Session):
        self.config = config
        self.Session = session
        self.application: Application | None = None  # type: ignore

    async def __aenter__(self) -> TelegramBot:
        try:
            await self.start()
        except TelegramError as e:
            logger.error(f"Couldn't start Telegram bot: {e}")
            raise
        return self

    async def __aexit__(
        self,
        exc_type: Type[BaseException] | None,
        exc_value: BaseException | None,
        traceback_: TracebackType | None,
    ) -> None:
        if self.application is not None:
            await self.stop()

    async def start(self) -> None:
        """
        Start the bot.
        """

        # Build application
        token = self.config.telegram_access_token
        # The Telegram API has some limits, so we need to rate limit:
        # - Max 30 messages per second total
        # - Max 20 messages per minute to the same group chat
        # These limits are set by default, so we only set the max_retries parameter.
        # See https://core.telegram.org/bots/faq#my-bot-is-hitting-limits-how-do-i-avoid-this
        rate_limiter = AIORateLimiter(max_retries=3)
        self.application = (
            Application.builder().token(token).rate_limiter(rate_limiter).build()
        )

        # Register cmmands to be shown in the menu in telegram
        await self.application.bot.set_my_commands(
            [
                telegram.BotCommand("start", "Register and start the bot"),
                telegram.BotCommand("help", "Show available commands"),
                telegram.BotCommand("manage", "Manage your subscriptions"),
                telegram.BotCommand("status", "Show your status"),
            ]
        )

        # Register "/..." commands
        self.application.add_handler(CommandHandler("announce", self.announce_command))
        self.application.add_handler(CommandHandler("channel", self.channel_command))
        self.application.add_handler(CommandHandler("debug", self.debug_command))
        self.application.add_handler(CommandHandler("error", self.error_command))
        self.application.add_handler(CommandHandler("help", self.help_command))
        self.application.add_handler(CommandHandler("leave", self.leave_command))
        self.application.add_handler(CommandHandler("manage", self.manage_command))
        self.application.add_handler(CommandHandler("refresh", self.refresh_command))
        self.application.add_handler(CommandHandler("start", self.start_command))
        self.application.add_handler(CommandHandler("status", self.status_command))
        self.application.add_handler(CommandHandler("timezone", self.timezone_command))
        # Fallback for all other messages starting with "/"
        self.application.add_handler(
            MessageHandler(filters.COMMAND, self.unknown_command)
        )

        # Register callback handlers
        self.application.add_handler(
            CallbackQueryHandler(self.toggle_subscription_callback, pattern="toggle")
        )
        self.application.add_handler(
            CallbackQueryHandler(self.set_timezone_callback, pattern="settimezone")
        )
        self.application.add_handler(
            CallbackQueryHandler(self.offer_callback, pattern="details")
        )
        self.application.add_handler(
            CallbackQueryHandler(self.dismiss_callback, pattern="dismiss")
        )
        self.application.add_handler(
            CallbackQueryHandler(self.close_callback, pattern="close")
        )

        # Register error handler
        self.application.add_error_handler(self.error_handler)

        # Start the bot
        await self.application.initialize()
        await self.application.start()
        if self.application.updater is not None:
            await self.application.updater.start_polling(
                error_callback=self.updater_error_handler
            )
            logger.info("Started listening for messages from Telegram")

    async def stop(self) -> None:
        """
        Stop the bot. The application needs to be restarted manually.
        See https://github.com/python-telegram-bot/python-telegram-bot/issues/801
        for a discussion of the behaviour before v20.
        """

        if self.application is None or self.application.updater is None:
            return

        await self.application.updater.stop()
        await self.application.stop()
        await self.application.shutdown()
        logger.info("Stopped listening for messages from Telegram")

    def updater_error_handler(self, error: TelegramError) -> None:
        # Multiple bot instances, abort to avoid Telegram punishing API key misuse!
        if isinstance(error, telegram.error.Conflict):
            error_text = "Multiple instances of the same bot running, shutting down myself to avoid further conflicts."
            logger.critical(error_text)

            # We need to run this in a separate task, because it runs asynchroniously
            asyncio.get_running_loop().create_task(
                self.notify_admin_and_stop(error_text)
            )
            return

        logger.error(f"Error while polling for messages from Telegram: {error}")

    async def notify_admin_and_stop(self, error_text: str) -> None:
        await self.send_message(
            chat_id=Config.get().telegram_developer_chat_id,
            text=error_text,
            parse_mode=None,
        )

        await self.stop()

    async def error_handler(
        self, update: object, context: ContextTypes.DEFAULT_TYPE
    ) -> None:
        """
        Log the error and send a telegram message to notify the developer chat.
        """

        # We can only continue if we have an actual exception
        if context.error is None:
            logger.error("Unknown error encountered in Telegram error handler.")
            return

        # Common case when a user clicks too fast on the "show details" button.
        # Nothing to do here, not an actual error.
        if isinstance(
            context.error, telegram.error.BadRequest
        ) and context.error.message.startswith("Message is not modified: "):
            return

        # Network instability causes that probably fix themselves.
        # Log as a warning, but do not alert the admin.
        if isinstance(context.error, RemoteDisconnected) or (
            isinstance(context.error, telegram.error.NetworkError)
            and not isinstance(context.error, telegram.error.BadRequest)
        ):
            exception_type = str(type(context.error))
            logger.warning(
                f"Network instability encountered ({exception_type}), probably will fix itself."
            )
            return

        if (
            isinstance(context.error, telegram.error.Forbidden)
            and isinstance(update, Update)
            and update.effective_chat
        ):
            # The bot was removed from a group chat.
            chat_id = update.effective_chat.id
            logger.info(
                f"Deactivating user with group chat id {chat_id} because the bot was removed from the group."
            )
            self.deactivate_user(chat_id, "removed group")
            return

        # Build the exception string from the exception
        traceback_string = "".join(
            traceback.format_exception(None, context.error, context.error.__traceback__)
        )

        # Get some additional information about what happened.
        if isinstance(update, Update):
            update_str = json.dumps(update.to_dict(), indent=2, ensure_ascii=False)
        else:
            update_str = str(update)

        full_debug_message = (
            f"An exception was raised while handling an update:\n\n"
            f"update = {update_str}\n\n"
        )

        # Put it all together in the message
        if context.chat_data:
            full_debug_message += f"context.chat_data = {str(context.chat_data)}\n\n"
        if context.user_data:
            full_debug_message += f"context.user_data = {str(context.user_data)}\n\n"
        full_debug_message += f"traceback = {traceback_string}"

        logger.error(full_debug_message)

    async def announce_command(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ) -> None:
        """Handle the /announce command: Add an announcement (admin only)."""

        del context  # Unused

        await self.log_call(update)

        if (
            not update.effective_user
            or not update.effective_chat
            or not update.message
            or not update.message.text
        ):
            return

        # Check if the user is an admin
        if not update.effective_user.id == Config.get().telegram_admin_user_id:
            await self.send_message(
                chat_id=update.effective_chat.id,
                text=markdown_escape(
                    "You are not an admin, so you can't use this command."
                ),
                parse_mode=telegram.constants.ParseMode.MARKDOWN_V2,
            )
            return

        try:
            # Get the announcement text
            message = update.message.text.removeprefix("/announce ")
            message_parts = message.split("||")
            header = message_parts[0].strip()
            text = message_parts[1].strip()

            self.add_announcement(header, text)
            await self.send_message(
                chat_id=update.effective_chat.id,
                text=markdown_escape(
                    "Announcement added successfully. Sending it with the next scraping run."
                ),
                parse_mode=telegram.constants.ParseMode.MARKDOWN_V2,
            )

        except IndexError:
            await self.send_message(
                chat_id=update.effective_chat.id,
                text=markdown_escape(
                    "Invalid announcement command. Format needs to be /announce <header> || <text>"
                ),
                parse_mode=telegram.constants.ParseMode.MARKDOWN_V2,
            )

    async def channel_command(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ) -> None:
        """Handle the /channel command: Manage channels (admin only)."""

        del context  # Unused

        await self.log_call(update)

        if (
            not update.effective_user
            or not update.effective_chat
            or not update.message
            or not update.message.text
        ):
            return

        # Check if the user is an admin
        if not update.effective_user.id == Config.get().telegram_admin_user_id:
            await self.send_message(
                chat_id=update.effective_chat.id,
                text=markdown_escape(
                    "You are not an admin, so you can't use this command."
                ),
                parse_mode=telegram.constants.ParseMode.MARKDOWN_V2,
            )
            return

        try:
            message = update.message.text.removeprefix("/channel ")
            message_parts = message.split(" ")
            channel_name = message_parts[0].strip()
            offer_type = OfferType[message_parts[1].strip()]
            source = Source[message_parts[2].strip()]
            duration = OfferDuration[message_parts[3].strip()]

            # Add the channel as a "user" to the database and set it to receive
            # the appropriate type of messages.

            channel_db_user = self.get_user_by_telegram_id(channel_name)

            if channel_db_user is None:
                # Register channel user if not registered yet
                session: orm.Session = self.Session()
                try:
                    latest_announcement = session.execute(
                        sa.select(sa.func.max(Announcement.id))
                    ).scalar()

                    new_user = User(
                        telegram_id=channel_name,
                        telegram_chat_id=channel_name,
                        telegram_user_details={
                            "description": "Channel user created by admin"
                        },
                        registration_date=datetime.now().replace(tzinfo=timezone.utc),
                        last_announcement_id=latest_announcement,
                    )
                    session.add(new_user)
                    session.commit()

                    channel_db_user = self.get_user_by_telegram_id(channel_name)
                except Exception:
                    session.rollback()
                    raise

            if channel_db_user is None:
                raise Exception("Channel user not found.")

            if self.is_subscribed(channel_db_user, offer_type, source, duration):
                self.unsubscribe(channel_db_user, offer_type, source, duration)

                await self.send_message(
                    chat_id=update.effective_chat.id,
                    text=markdown_escape(
                        (
                            f"Channel {channel_db_user.telegram_chat_id} is now unsubscribed "
                            f"to offers from: {offer_type.value} / {source.value} / {duration.value}."
                        )
                    ),
                    parse_mode=telegram.constants.ParseMode.MARKDOWN_V2,
                )
            else:
                self.subscribe(channel_db_user, offer_type, source, duration)

                await self.send_message(
                    chat_id=update.effective_chat.id,
                    text=markdown_escape(
                        (
                            f"Channel {channel_db_user.telegram_chat_id} is now subscribed "
                            f"to offers from: {offer_type.value} / {source.value} / {duration.value}."
                            f"Sending new offers with the next scraping run."
                        )
                    ),
                    parse_mode=telegram.constants.ParseMode.MARKDOWN_V2,
                )

        except IndexError:
            await self.send_message(
                chat_id=update.effective_chat.id,
                text=markdown_escape(
                    "Invalid channel command. Format needs to be /channel <channel_name> <offer_type> <source> <duration>."
                ),
                parse_mode=telegram.constants.ParseMode.MARKDOWN_V2,
            )

    async def debug_command(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ) -> None:
        """Handle the /debug command: Show some debug information."""

        del context  # Unused

        await self.log_call(update)

        if update.message is None:
            return

        if update.effective_chat is not None and update.effective_user is not None:
            await self.send_message(
                chat_id=update.effective_chat.id,
                text=markdown_json_formatted(
                    f"update.effective_user = {json.dumps(update.effective_user.to_dict(), indent=2, ensure_ascii=False)}"
                )
                + markdown_json_formatted(
                    f"update.effective_chat = {json.dumps(update.effective_chat.to_dict(), indent=2, ensure_ascii=False)}"
                ),
                parse_mode=telegram.constants.ParseMode.MARKDOWN_V2,
            )

    async def error_command(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ) -> None:
        """Handle the /error command: Trigger an error to send to the dev chat."""

        del context  # Unused

        await self.log_call(update)

        raise Exception("This is a test error triggered by the /error command.")

    async def help_command(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ) -> None:
        """Handle the /help command: Display all available commands to the user."""

        del context  # Unused

        await self.log_call(update)

        if update.message is None:
            return

        await update.message.reply_markdown_v2(MESSAGE_HELP)

    async def leave_command(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ) -> None:
        """Handle the /leave command: Unregister the user."""

        del context  # Unused

        await self.log_call(update)

        if update.message is None or update.effective_user is None:
            return

        db_user = self.get_user_by_telegram_id(update.effective_user.id)

        if db_user is None:
            message = (
                Rf"Hi {update.effective_user.mention_markdown_v2()}, you are currently not registered\. "
                R"So you can't leave ;\-\)"
            )
            logger.debug(f"Sending /leave reply: {message}")
            await update.message.reply_markdown_v2(message)
            return

        # Delete user from database (if registered)
        session: orm.Session = self.Session()
        try:
            session.delete(db_user)
            session.commit()
        except Exception:
            session.rollback()
            raise

        message = (
            Rf"Bye {update.effective_user.mention_markdown_v2()}, I'm sad to see you go\. "
            R"Your user data has been deleted\. "
            R"If you want to come back at any time, just type /start\!"
        )
        logger.debug(f"Sending /leave reply: {message}")
        await update.message.reply_markdown_v2(message)

    async def manage_command(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ) -> None:
        """Handle the /manage command: Manage subscriptions."""

        del context  # Unused

        await self.log_call(update)

        if update.message is None or update.effective_user is None:
            return

        db_user = self.get_user_by_telegram_id(update.effective_user.id)
        if db_user is None:
            await update.message.reply_text(MESSAGE_USER_NOT_REGISTERED)
            return

        await update.message.reply_text(
            MESSAGE_MANAGE_MENU,
            reply_markup=self.manage_keyboard(db_user),
        )

    async def refresh_command(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ) -> None:
        """Handle the /refresh command: Send all offers once that have not been sent yet.."""

        del context  # Unused

        await self.log_call(update)

        if update.effective_chat is None or update.effective_user is None:
            return

        db_user = self.get_user_by_telegram_id(update.effective_user.id)
        if db_user is None:
            await self.send_message(
                chat_id=update.effective_chat.id,
                text=MESSAGE_USER_NOT_REGISTERED,
                parse_mode=None,
            )
            return

        if (
            db_user.telegram_subscriptions is None
            or len(db_user.telegram_subscriptions) == 0
        ):
            await self.send_message(
                chat_id=update.effective_chat.id,
                text=MESSAGE_NO_SUBSCRIPTIONS,
                parse_mode=None,
            )
            return

        if not await self.send_new_offers(db_user):
            await self.send_message(
                chat_id=update.effective_chat.id,
                text=MESSAGE_NO_NEW_OFFERS,
                parse_mode=None,
            )

    async def start_command(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ) -> None:
        """Handle the /start command: Register the user and display guide."""

        await self.log_call(update)

        if update.message is None or update.effective_user is None:
            return

        welcome_text = (
            R"I belong to the [LootScraper](https://github\.com/eikowagenknecht/lootscraper) project\. "
            R"If you have any issues or feature request, please use the "
            R"[Github issues](https://github\.com/eikowagenknecht/lootscraper/issues) to report them\. "
            R"And if you like it, please consider "
            R"[⭐ starring it on GitHub](https://github\.com/eikowagenknecht/lootscraper/stargazers)\. "
            R"Thanks\!"
            "\n\n"
            R"*How this works*"
            "\n"
            R"For a quick start, I just subscribed you to free offers from Steam, Epic and GOG\. "
            R"There are more sources available\. To configure what kind of offers you want to see, you can use the /manage command\. "
            R"I will then send you a message every time a new offer is added\. "
            R"To see the commands you can use to talk to me, type /help\."
            "\n\n"
            R"*Privacy*"
            "\n"
            R"I need to store some user data \(e\.g\. your Telegram user ID and your subscriptions\) to work\. "
            R"You can leave any time by typing /leave\. "
            R"This instantly deletes all data about you\. "
            R"Also I will be sad to see you go\."
        )

        db_user = self.get_user_by_telegram_id(update.effective_user.id)

        if db_user is not None:
            message = (
                Rf"Welcome back, {update.effective_user.mention_markdown_v2()} 👋\. "
                + R"You are already registered ❤\. "
                + R"In case you forgot, this was my initial message to you:"
                + "\n\n"
                + welcome_text
            )
            logger.debug(f"Sending /start reply: {message}")
            await update.message.reply_markdown_v2(message)
            return

        # Register user if not registered yet
        session: orm.Session = self.Session()
        try:
            latest_announcement = session.execute(
                sa.select(sa.func.max(Announcement.id))
            ).scalar()

            new_user = User(
                telegram_id=update.effective_user.id,
                telegram_chat_id=update.effective_chat.id
                if update.effective_chat
                else None,
                telegram_user_details=update.effective_user.to_json(),
                registration_date=datetime.now().replace(tzinfo=timezone.utc),
                last_announcement_id=latest_announcement,
            )
            session.add(new_user)
            session.commit()
        except Exception:
            session.rollback()
            raise

        # Subscribe user to some default categories
        self.subscribe(new_user, OfferType.GAME, Source.STEAM, OfferDuration.CLAIMABLE)
        self.subscribe(new_user, OfferType.GAME, Source.GOG, OfferDuration.CLAIMABLE)
        self.subscribe(new_user, OfferType.GAME, Source.EPIC, OfferDuration.CLAIMABLE)

        message = (
            Rf"Hi {update.effective_user.mention_markdown_v2()} 👋, welcome to the LootScraper Telegram Bot and thank you for registering\!"
            + "\n\n"
            + welcome_text
        )
        logger.debug(f"Sending /start reply: {message}")
        await update.message.reply_markdown_v2(message)

        # Send all current offers once
        await self.refresh_command(update, context)

        # Notify about the new registration
        if Config.get().telegram_log_level.value >= TelegramLogLevel.DEBUG.value:
            message = (
                Rf"New user {update.effective_user.mention_markdown_v2()} registered\."
            )
            logger.debug(f"Sending user registered message: {message}")
            await self.send_message(
                chat_id=Config.get().telegram_developer_chat_id,
                text=message,
                parse_mode=telegram.constants.ParseMode.MARKDOWN_V2,
            )

    async def status_command(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ) -> None:
        """Handle the /status command: Display some statistics about the user."""

        del context  # Unused

        await self.log_call(update)

        if not update.effective_chat or not update.effective_user or not update.message:
            return

        db_user = self.get_user_by_telegram_id(update.effective_user.id)
        if db_user is None:
            message = (
                Rf"Hi {update.effective_user.mention_markdown_v2()}, you are currently not registered\. "
                R"So there is no data stored about you\. "
                R"But I'd be happy to see you register any time with the /start command\!"
            )
            logger.debug(f"Sending /status reply: {message}")
            await update.message.reply_markdown_v2(message)
            return

        subscriptions_text: str
        if len(db_user.telegram_subscriptions) > 0:
            subscriptions_text = (
                Rf"\- You have {len(db_user.telegram_subscriptions)} subscriptions\. "
            )
            subscriptions_text += (
                R"Here are the categories you are subscribed to: " + "\n"
            )
            for subscription in db_user.telegram_subscriptions:
                subscriptions_text += markdown_escape(
                    f"  * {subscription.source.value} / {subscription.type.value} / {subscription.duration.value}\n"
                )
            subscriptions_text += (
                R"You can unsubscribe from them any time with /manage\."
            )
        else:
            subscriptions_text = (
                R"\- You are currently not subscribed to any categories\. "
                R"You can change that with the /manage command if you wish\."
            )

        if db_user.timezone_offset:
            timezone_text = (
                Rf"\- Your timezone is set to {markdown_escape(db_user.timezone_offset)} hours\. "
                R"You can change that with the /timezone command if you wish\."
            )
        else:
            timezone_text = (
                R"\- Your timezone is not set, so UTC is used\. "
                R"You can change that with the /timezone command if you wish\."
            )

        message = (
            Rf"Hi {update.effective_user.mention_markdown_v2()}, you are currently registered\. "
            R"But I'm not storing much user data, so this is all I know about you: "
            "\n\n"
            Rf"\- You registered on {markdown_escape(db_user.registration_date.strftime(TIMESTAMP_READABLE_WITH_HOUR))} with the /start command\."
            "\n"
            Rf"\- Your Telegram chat id is {markdown_escape(db_user.telegram_chat_id)}\. "
            R"Neat, huh? I use it to send you notifications\."
            "\n"
            f"{subscriptions_text}"
            "\n"
            Rf"\- You received {markdown_escape(db_user.offers_received_count)} offers so far\. "
            "\n"
            f"{timezone_text}"
        )
        logger.debug(f"Sending /status reply: {message}")
        await update.message.reply_markdown_v2(message)

    async def timezone_command(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ) -> None:
        """Handle timezonelist command."""

        del context  # Unused

        await self.log_call(update)

        if not update.effective_chat:
            return

        await self.send_message(
            chat_id=update.effective_chat.id,
            text="Choose one of these available timezones:",
            reply_markup=self.timezone_keyboard(),
            parse_mode=None,
        )

    async def unknown_command(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ) -> None:
        """Handle unknown commands."""

        del context  # Unused

        await self.log_call(update)

        if not update.effective_chat:
            return

        # Special handling for channels
        if update.effective_chat.type == update.effective_chat.CHANNEL:
            await self.send_message(
                chat_id=update.effective_chat.id,
                text=markdown_escape(
                    f"Commands are not supported in channels. This channel has the id {update.effective_chat.id}."
                ),
                parse_mode=telegram.constants.ParseMode.MARKDOWN_V2,
            )
            return

        # Normal chats
        await self.send_message(
            chat_id=update.effective_chat.id,
            text=MESSAGE_UNKNOWN_COMMAND,
            parse_mode=None,
        )

    async def offer_callback(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ) -> None:
        """Callback from the menu buttons "Details" and "Summary" in the offer message."""

        del context  # Unused

        await self.log_call(update)

        if update.callback_query is None or update.effective_user is None:
            return

        query = update.callback_query

        if query.data is None:
            return

        db_user = self.get_user_by_telegram_id(update.effective_user.id)
        if db_user is None:
            return

        offer_id = int(query.data.split(" ")[2])
        try:
            session: orm.Session = self.Session()
            offer = session.execute(
                sa.select(Offer).where(Offer.id == offer_id)
            ).scalar()
            if query.data.startswith("details show"):
                await query.answer()
                await query.edit_message_text(
                    text=self.offer_details_message(
                        offer,
                        tzoffset=db_user.timezone_offset,
                    ),
                    parse_mode=telegram.constants.ParseMode.MARKDOWN_V2,
                    reply_markup=self.offer_keyboard(
                        offer,
                        details_hide_button=True,
                        details_show_button=False,
                        dismiss_button=True,
                    ),
                )
            elif query.data.startswith("details hide"):
                await query.answer()
                await query.edit_message_text(
                    text=self.offer_message(offer, tzoffset=db_user.timezone_offset),
                    parse_mode=telegram.constants.ParseMode.MARKDOWN_V2,
                    reply_markup=self.offer_keyboard(
                        offer,
                        details_hide_button=False,
                        details_show_button=True,
                        dismiss_button=True,
                    ),
                )
        except Exception:
            session.rollback()
            raise

    async def dismiss_callback(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ) -> None:
        """Callback from the menu button "Dismiss" in the offer message."""

        del context  # Unused

        await self.log_call(update)

        if update.callback_query is None:
            return

        try:
            await update.callback_query.delete_message()
            return
        except telegram.error.BadRequest:
            # Message could not be deleted, probably it's older than 48h
            pass

        try:
            await update.callback_query.edit_message_text(
                text=MESSAGE_DISMISSED,
            )
            return
        except telegram.error.BadRequest:
            # Message could not be edited, probably a doubleclick
            pass

    async def close_callback(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ) -> None:
        """Callback from the menu button "Close" in various menus."""

        await self.log_call(update)

        if update.callback_query is None or update.effective_user is None:
            return

        query = update.callback_query

        if query.data == "close manage":
            await query.answer(text="Bye!")
            await query.edit_message_text(
                text=MESSAGE_MANAGE_MENU_CLOSED,
            )
        elif query.data == "close timezone":
            await query.answer(text="Bye!")
            await query.edit_message_text(
                text=MESSAGE_TIMEZONE_MENU_CLOSED,
            )

        # Send outstanding offers to the user
        await self.refresh_command(update, context)

    async def toggle_subscription_callback(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ) -> None:
        """Callback from the subscription buttons in the manage menu."""

        del context  # Unused

        await self.log_call(update)

        query = update.callback_query
        if query is None or update.effective_user is None or query.data is None:
            return

        db_user = self.get_user_by_telegram_id(update.effective_user.id)
        if db_user is None:
            await query.answer(text=MESSAGE_USER_NOT_REGISTERED)
            return

        data = query.data.lower().removeprefix("toggle").strip().upper().split(" ")
        source = Source[data[0]]
        type_ = OfferType[data[1]]
        duration = OfferDuration[data[2]]

        answer_text = None

        if not self.is_subscribed(db_user, type_, source, duration):
            self.subscribe(db_user, type_, source, duration)
            answer_text = POPUP_SUBSCRIBED
        else:
            self.unsubscribe(db_user, type_, source, duration)
            answer_text = POPUP_UNSUBSCRIBED

        await query.answer(text=answer_text)
        await query.edit_message_text(
            text=MESSAGE_MANAGE_MENU,
            reply_markup=self.manage_keyboard(db_user),
        )

    async def set_timezone_callback(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ) -> None:
        """Callback from the timezone buttons in the timezone menu."""

        del context  # Unused

        await self.log_call(update)

        query = update.callback_query
        if query is None or update.effective_user is None or query.data is None:
            return

        data = int(query.data.removeprefix("settimezone").strip())

        session: orm.Session = self.Session()
        try:
            db_user = self.get_user_by_telegram_id(update.effective_user.id)
            if db_user is None:
                await query.answer(text=MESSAGE_USER_NOT_REGISTERED)
                return
            db_user.timezone_offset = data
            session.commit()
        except Exception:
            session.rollback()
            raise

        await query.edit_message_text(
            text=f"Timezone offset set to {data} hours from UTC. {MESSAGE_TIMEZONE_MENU_CLOSED}",
        )

    async def send_new_offers(self, user: User) -> bool:
        """Send all new offers for the user."""

        subscriptions = user.telegram_subscriptions

        offers_sent = 0
        subscription: TelegramSubscription
        session: orm.Session = self.Session()
        try:
            for subscription in subscriptions:
                offers: list[Offer] = (
                    session.execute(
                        sa.select(Offer).where(
                            sa.and_(
                                Offer.type == subscription.type,
                                Offer.source == subscription.source,
                                Offer.duration == subscription.duration,
                                Offer.id > subscription.last_offer_id,
                                # Only send offers that are already active
                                sa.or_(
                                    Offer.valid_from <= datetime.now().replace(tzinfo=None),  # type: ignore
                                    Offer.valid_from.is_(None),  # type: ignore
                                ),
                                # Prefilter to reduce database load. The details are handled below.
                                sa.or_(
                                    Offer.valid_to >= datetime.now().replace(tzinfo=None),  # type: ignore
                                    Offer.seen_last >= datetime.now().replace(tzinfo=None) - timedelta(days=1),  # type: ignore
                                    Offer.valid_to.is_(None),  # type: ignore
                                ),
                            )
                        )
                    )
                    .scalars()
                    .all()
                )

                # Filter out offers that have a real end date that is in the future
                filtered_offers = []

                for offer in offers:
                    real_valid_to = offer.real_valid_to()
                    if real_valid_to is None or real_valid_to > datetime.now().replace(
                        tzinfo=timezone.utc
                    ):
                        filtered_offers.append(offer)

                if len(filtered_offers) == 0:
                    continue

                offers_sent += len(filtered_offers)

                # Send the offers
                for offer in filtered_offers:
                    await self.send_offer(offer, user)

                # Update the last offer id
                subscription.last_offer_id = filtered_offers[-1].id
                user.offers_received_count = user.offers_received_count + len(
                    filtered_offers
                )
                session.commit()
        except Exception:
            session.rollback()
            raise

        return bool(offers_sent)

    async def send_new_announcements(self, user: User) -> None:
        session: orm.Session = self.Session()
        try:
            announcements: list[Announcement] = (
                session.execute(
                    sa.select(Announcement).where(
                        sa.and_(
                            sa.or_(
                                Announcement.channel == Channel.ALL,
                                Announcement.channel == Channel.TELEGRAM,
                            ),
                            Announcement.id > user.last_announcement_id,
                        )
                    )
                )
                .scalars()
                .all()
            )

            if len(announcements) == 0:
                return

            user.last_announcement_id = announcements[-1].id
            session.commit()

            # Send the offers
            for announcement in announcements:
                await self.send_announcement(announcement, user)
        except Exception:
            session.rollback()
            raise

    def get_user_by_telegram_id(self, telegram_id: int | str) -> User | None:
        session: orm.Session = self.Session()
        try:
            db_user = (
                session.execute(sa.select(User).where(User.telegram_id == telegram_id))
                .scalars()
                .one_or_none()
            )
        except Exception:
            session.rollback()
            raise

        return db_user

    def get_user_by_chat_id(self, chat_id: int | str) -> User | None:
        try:
            session: orm.Session = self.Session()
            db_user = (
                session.execute(sa.select(User).where(User.telegram_chat_id == chat_id))
                .scalars()
                .one_or_none()
            )
        except Exception:
            session.rollback()
            raise

        return db_user

    def is_subscribed(
        self, user: User, type_: OfferType, source: Source, duration: OfferDuration
    ) -> bool:
        session: orm.Session = self.Session()
        existing_subscriptions = 0
        try:
            existing_subscriptions = (
                session.query(TelegramSubscription)
                .filter(
                    sa.and_(
                        TelegramSubscription.user_id == user.id,
                        TelegramSubscription.type == type_,
                        TelegramSubscription.source == source,
                        TelegramSubscription.duration == duration,
                    )
                )
                .count()
            )
        except Exception:
            session.rollback()
            raise

        return existing_subscriptions > 0

    def subscribe(
        self, user: User, type_: OfferType, source: Source, duration: OfferDuration
    ) -> None:
        session: orm.Session = self.Session()
        try:
            if self.is_subscribed(user, type_, source, duration):
                return

            session.add(
                TelegramSubscription(
                    user=user, source=source, type=type_, duration=duration
                )
            )
            session.commit()
        except Exception:
            session.rollback()
            raise

    def unsubscribe(
        self, user: User, type_: OfferType, source: Source, duration: OfferDuration
    ) -> None:
        session: orm.Session = self.Session()
        try:
            session.query(TelegramSubscription).filter(
                sa.and_(
                    TelegramSubscription.user_id == user.id,
                    TelegramSubscription.type == type_,
                    TelegramSubscription.source == source,
                    TelegramSubscription.duration == duration,
                )
            ).delete()
            session.commit()
        except Exception:
            session.rollback()
            raise

    async def manage_menu(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ) -> None:
        del context  # Unused

        if update.callback_query is None or update.effective_user is None:
            return

        db_user = self.get_user_by_telegram_id(update.effective_user.id)
        if db_user is None:
            await update.callback_query.answer(text=MESSAGE_USER_NOT_REGISTERED)
            return

        await update.callback_query.answer()
        await update.callback_query.edit_message_text(
            text=MESSAGE_MANAGE_MENU,
            reply_markup=self.manage_keyboard(db_user),
        )

    def manage_keyboard(self, user: User) -> InlineKeyboardMarkup:
        keyboard: list[list[InlineKeyboardButton]] = []

        # Add buttons for all available categories
        for scraper in get_all_scrapers():
            scraper_source = scraper.get_source()
            scraper_type = scraper.get_type()
            scraper_duration = scraper.get_duration()

            if any(
                x.source == scraper_source
                and x.type == scraper_type
                and x.duration == scraper_duration
                for x in user.telegram_subscriptions
            ):
                keyboard.append(
                    subscription_button(
                        True, scraper_source, scraper_type, scraper_duration
                    )
                )
            else:
                keyboard.append(
                    subscription_button(
                        False, scraper_source, scraper_type, scraper_duration
                    )
                )

        keyboard.append(
            [InlineKeyboardButton(text=BUTTON_CLOSE, callback_data="close manage")]
        )

        return InlineKeyboardMarkup(keyboard)

    def timezone_keyboard(self) -> InlineKeyboardMarkup:
        keyboard: list[list[InlineKeyboardButton]] = []

        # Add buttons for all available categories
        for hour in range(-12, 15):
            hourstr = str(hour)
            if not hourstr.startswith("-"):
                hourstr = "+" + str(hour)
            keyboard.append(
                [
                    InlineKeyboardButton(
                        text=f"UTC{hourstr}:00", callback_data=f"settimezone {hourstr}"
                    )
                ]
            )

        keyboard.append(
            [InlineKeyboardButton(text=BUTTON_CLOSE, callback_data="close timezone")]
        )

        return InlineKeyboardMarkup(keyboard)

    def offer_keyboard(
        self,
        offer: Offer,
        details_show_button: bool = False,
        details_hide_button: bool = False,
        dismiss_button: bool = False,
    ) -> InlineKeyboardMarkup:
        keyboard: list[list[InlineKeyboardButton]] = []

        first_row: list[InlineKeyboardButton] = []

        if offer.url:
            first_row.append(
                InlineKeyboardButton(
                    text=BUTTON_CLAIM,
                    url=offer.url,
                )
            )

        if details_show_button:
            first_row.append(
                InlineKeyboardButton(
                    text=BUTTON_SHOW_DETAILS,
                    callback_data=f"details show {offer.id}",
                )
            )

        if details_hide_button:
            first_row.append(
                InlineKeyboardButton(
                    text=BUTTON_HIDE_DETAILS,
                    callback_data=f"details hide {offer.id}",
                )
            )

        if dismiss_button:
            first_row.append(
                InlineKeyboardButton(
                    text=BUTTON_DISMISS,
                    callback_data=f"dismiss {offer.id}",
                )
            )

        keyboard.append(first_row)

        return InlineKeyboardMarkup(keyboard)

    async def send_offer(self, offer: Offer, user: User) -> bool:
        logger.debug(
            f"Sending offer {offer.title} to Telegram user {user.telegram_id}."
        )

        # Special treatment for channels
        if user.telegram_chat_id.startswith("@") or user.telegram_chat_id.startswith(
            "-100"
        ):
            markup = self.offer_keyboard(offer)

            success = await self.send_message(
                chat_id=user.telegram_chat_id,
                text=self.offer_details_message(
                    offer,
                    tzoffset=user.timezone_offset,
                ),
                reply_markup=markup,
            )
            return success is not None

        # Normal users
        details_button = bool(
            offer.game and (offer.game.igdb_info or offer.game.steam_info)
        )

        markup = self.offer_keyboard(
            offer,
            details_show_button=details_button,
            details_hide_button=False,
            dismiss_button=True,
        )

        success = await self.send_message(
            chat_id=user.telegram_chat_id,
            text=self.offer_message(
                offer,
                tzoffset=user.timezone_offset,
            ),
            reply_markup=markup,
        )
        return success is not None

    async def send_announcement(self, announcement: Announcement, user: User) -> None:
        logger.debug(
            f"Sending announcement {announcement.id} to Telegram user {user.telegram_id}."
        )
        await self.send_message(
            chat_id=user.telegram_chat_id,
            text=announcement.text_markdown,
            reply_markup=None,
        )

    def offer_message(self, offer: Offer, *, tzoffset: int | None = 0) -> str:
        source = offer.source.value
        additional_info = offer.type.value
        if offer.duration != OfferDuration.CLAIMABLE:
            additional_info += f", {offer.duration.value}"

        content = markdown_bold(
            f"{offer.title} - {source} ({additional_info})"
        ) + markdown_escape(f" [{offer.id}")

        # Put the image first for the Telegram preview image
        if offer.img_url:
            content += markdown_url(offer.img_url, R"*")
        elif offer.game and offer.game.steam_info and offer.game.steam_info.image_url:
            content += markdown_url(offer.game.steam_info.image_url, R"*")

        content += markdown_escape("]")
        if offer.url:
            content += markdown_escape(" - ") + markdown_url(offer.url, "[Claim here]")

        content += "\n\n"

        if offer.valid_to:
            if tzoffset is None:
                tzoffset = 0
            if tzoffset == 0:
                valid_to_localized = (
                    offer.valid_to.strftime(TIMESTAMP_READABLE_WITH_HOUR) + " UTC"
                )
            else:
                valid_to_localized = (
                    offer.valid_to.astimezone(
                        timezone(timedelta(hours=tzoffset))
                    ).strftime(TIMESTAMP_READABLE_WITH_HOUR)
                    + f" UTC{tzoffset:+d}"
                )

            time_to_end = humanize.naturaldelta(
                datetime.now().replace(tzinfo=timezone.utc) - offer.valid_to
            )
            if datetime.now().replace(tzinfo=timezone.utc) > offer.valid_to:
                content += f"Offer expired {markdown_escape(time_to_end)} ago"
            else:
                content += f"Offer expires in {markdown_escape(time_to_end)}"
            content += markdown_escape(f" ({valid_to_localized}).")
        elif offer.duration == OfferDuration.ALWAYS:
            content += markdown_escape("Offer will stay free, no need to hurry.")
        else:
            content += markdown_escape(
                "Offer is valid forever.. just kidding, I just don't know when it will end."
            )

        return content

    def offer_details_message(self, offer: Offer, *, tzoffset: int | None = 0) -> str:
        content = self.offer_message(offer, tzoffset=tzoffset)

        if offer.game:
            game: Game = offer.game

            # "\n\n__Details__\n\n"
            if game.igdb_info and game.igdb_info.name:
                content += (
                    "\n\n__"
                    + Rf'More info about "{markdown_escape(game.igdb_info.name)}":'
                    + "__\n"
                )
            elif game.steam_info and game.steam_info.name:
                content += (
                    "\n\n__"
                    + Rf'More info about "{markdown_escape(game.steam_info.name)}":'
                    + "__\n"
                )
            else:
                # No Steam or IGDB info = no details
                return content

            ratings = []
            if game.steam_info and game.steam_info.metacritic_score:
                text = f"Metacritic {game.steam_info.metacritic_score} %"
                if game.steam_info.metacritic_url:
                    text = markdown_url(game.steam_info.metacritic_url, text)
                ratings.append(text)
            if (
                game.steam_info
                and game.steam_info.percent
                and game.steam_info.score
                and game.steam_info.recommendations
            ):
                text = Rf"Steam {game.steam_info.percent} % ({game.steam_info.score}/10, {game.steam_info.recommendations} recommendations)"
                text = markdown_url(game.steam_info.url, text)
                ratings.append(text)
            if (
                game.igdb_info
                and game.igdb_info.meta_ratings
                and game.igdb_info.meta_score
            ):
                text = Rf"IGDB Meta {game.igdb_info.meta_score} % ({game.igdb_info.meta_ratings} sources)"
                text = markdown_url(game.igdb_info.url, text)
                ratings.append(text)
            if (
                game.igdb_info
                and game.igdb_info.user_ratings
                and game.igdb_info.user_score
            ):
                text = Rf"IGDB User {game.igdb_info.user_score} % ({game.igdb_info.user_ratings} sources)"
                text = markdown_url(game.igdb_info.url, text)
                ratings.append(text)

            if len(ratings) > 0:
                ratings_str = f"*Ratings:* {' / '.join(ratings)}\n"
                content += ratings_str
            if game.igdb_info and game.igdb_info.release_date:
                content += f"*Release date:* {markdown_escape(game.igdb_info.release_date.strftime(TIMESTAMP_SHORT))}\n"
            elif game.steam_info and game.steam_info.release_date:
                content += f"*Release date:* {markdown_escape(game.steam_info.release_date.strftime(TIMESTAMP_SHORT))}\n"
            if game.steam_info and game.steam_info.recommended_price_eur:
                content += (
                    Rf"*Recommended price \(Steam\):* {markdown_escape(str(game.steam_info.recommended_price_eur))} EUR"
                    + "\n"
                )
            if game.steam_info and game.steam_info.genres:
                content += f"*Genres:* {markdown_escape(game.steam_info.genres)}\n"
            if game.igdb_info and game.igdb_info.short_description:
                content += f"*Description:* {markdown_escape(game.igdb_info.short_description)}\n"
            elif game.steam_info and game.steam_info.short_description:
                content += f"*Description:* {markdown_escape(game.steam_info.short_description)}\n"

        return content

    async def send_message(
        self,
        chat_id: int | str,
        text: str,
        parse_mode: str | None = telegram.constants.ParseMode.MARKDOWN_V2,
        **kwargs: Any,
    ) -> Message | None:  # type: ignore
        """
        Wrapper around the message sending to handle exceptions.
        """
        if self.application is None:
            logger.error(
                "Tried to send message while the application is not initialized."
            )
            return None

        message_handled = False
        send_attempt = 0

        while not message_handled:
            try:
                send_attempt = send_attempt + 1
                message = await self.application.bot.send_message(
                    chat_id=chat_id,
                    text=text,
                    parse_mode=parse_mode,
                    **kwargs,
                )
                message_handled = True
                return message
            except telegram.error.TimedOut as e:
                # Telegram is not responding. This is not handled by the AIORateLimiter.
                if send_attempt > 3:
                    logger.error(e)
                    return None
                retry_in_seconds = 5.0
                await asyncio.sleep(retry_in_seconds)
            except telegram.error.Forbidden as e:
                message_handled = True
                # The user blocked the chat.
                logger.info(
                    f"Deactivating user with chat id {chat_id} because he blocked the chat: {e}"
                )
                self.deactivate_user(chat_id, "blocked chat")
            except TelegramError as e:
                message_handled = True
                # The chat could not be found
                if e.message == "Chat not found":
                    logger.info(
                        f"Deactivating user with chat id {chat_id} because the chat could not be found."
                    )
                    self.deactivate_user(chat_id, "not found")
                else:
                    logger.error(e)

        return None

    def deactivate_user(self, chat_id: int | str, reason: str) -> None:
        db_user = self.get_user_by_chat_id(chat_id)

        if db_user is None:
            return

        # User is registered, deactivate him.
        logger.debug(f"Deactivating user {db_user.telegram_id}.")

        session: orm.Session = self.Session()
        try:
            db_user.inactive = reason
            session.commit()
        except Exception:
            session.rollback()
            raise

    def remove_user(self, chat_id: int | str) -> None:
        db_user = self.get_user_by_chat_id(chat_id)

        if db_user is None:
            return

        # User is registered, remove him from the database.
        logger.debug(f"Removing user {db_user.telegram_id} from database.")

        session: orm.Session = self.Session()
        try:
            session.delete(db_user)
            session.commit()
        except Exception:
            session.rollback()
            raise

    async def log_call(self, update: Update) -> None:
        # Only log calls from users if the log level is set to debug.
        if Config.get().telegram_log_level.value >= TelegramLogLevel.DEBUG.value:
            if update.callback_query:
                type_ = "Callback query"
            else:
                type_ = "Message"

            if update.effective_user:
                user = update.effective_user.name
                if user and user.startswith("@"):
                    user = "(@)" + user.removeprefix("@")
            else:
                user = "unknown user"

            if update.callback_query and update.callback_query.data:
                content = f"with content {update.callback_query.data}"
            elif update.effective_message:
                content = f"with content {update.effective_message.text_markdown_v2}"
            else:
                content = "without content"

            message = markdown_escape(f"{type_} from {user} {content}")
            logger.debug(message)
            await self.send_message(
                chat_id=Config.get().telegram_developer_chat_id,
                text=message,
            )

    def add_announcement(self, header: str, text: str) -> None:
        """
        Add an announcement to the database
        """

        announcement_full = (
            "*" + markdown_escape(header) + "*" + "\n\n" + markdown_escape(text)
        )

        announcement = Announcement(
            channel=Channel.TELEGRAM,
            date=datetime.now().replace(tzinfo=timezone.utc),
            text_markdown=announcement_full,
        )

        session: orm.Session = self.Session()
        try:
            session.add(announcement)
            session.commit()
        except Exception:
            session.rollback()
            raise


class TelegramLoggingHandler(logging.Handler):
    def __init__(self, bot: TelegramBot):
        super().__init__()
        self.bot = bot

    def emit(self, record: logging.LogRecord) -> None:
        """Try to send a log message to telegram."""

        try:
            message = self.format(record)

            # Max message length is 4096, so we need to split it up. We use 3000
            # to be on the safe side and have room for some markdown wrapping.
            message_in_chunks = chunkstring(message, 3000)

            for chunk in message_in_chunks:
                message = "```\n" + (markdown_escape(chunk)) + "\n```"

                asyncio.create_task(
                    self.bot.send_message(
                        chat_id=Config.get().telegram_developer_chat_id,
                        text=message,
                        parse_mode=telegram.constants.ParseMode.MARKDOWN_V2,
                    )
                )

        except Exception:  # pylint: disable=broad-except
            self.handleError(record)


def markdown_json_formatted(input_: str) -> str:
    return f"```json\n{input_}\n```"


def subscription_button(
    active: bool,
    source: Source,
    offer_type: OfferType,
    offer_duration: OfferDuration,
) -> list[InlineKeyboardButton]:
    is_subscribed_str = "[x] " if active else ""
    source_str = f"{source.value} {offer_type.value}"
    if offer_duration != OfferDuration.CLAIMABLE:
        source_str += f" ({offer_duration.value})"
    command = f"toggle {source.name} {offer_type.name} {offer_duration.name}"

    return [
        InlineKeyboardButton(
            f"{is_subscribed_str}{source_str}",
            callback_data=command,
        )
    ]

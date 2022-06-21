from __future__ import annotations

import json
import logging
import os
import signal
import traceback
from datetime import datetime, timedelta, timezone
from http.client import RemoteDisconnected
from types import TracebackType
from typing import Type
from urllib.error import HTTPError

import humanize
import telegram
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session
from telegram import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
    ParseMode,
    TelegramError,
    Update,
)
from telegram.ext import (
    CallbackContext,
    CallbackQueryHandler,
    CommandHandler,
    Filters,
    MessageHandler,
    Updater,
)

from app.common import (
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
from app.configparser import Config, ParsedConfig, TelegramLogLevel
from app.scraper.loot.scraperhelper import get_all_scrapers
from app.sqlalchemy import Announcement, Game, Offer, TelegramSubscription, User, and_

BUTTON_SHOW_DETAILS = "Show details"
BUTTON_HIDE_DETAILS = "Hide details"
BUTTON_CLOSE = "Close"

POPUP_SUBSCRIBED = "You are now subscribed."
POPUP_UNSUBSCRIBED = "You are now unsubscribed."

MESSAGE_MANAGE_MENU = (
    "Here you can manage your subscriptions. "
    "To do so, just click the following buttons to subscribe / unsubscribe. "
)
MESSAGE_MANAGE_MENU_CLOSED = (
    "Thank you for managing your subscriptions. "
    "Forgot something? "
    "You can continue any time with /manage. "
    "If you want me to send you all current offers of your subscriptions, you can type /offers now or any time later."
)
MESSAGE_HELP = markdown_bold("Available commands") + markdown_escape(
    "\n/start - Start the bot (you already did that)"
    "\n/help - Show this help message"
    "\n/status - Show information about your subscriptions"
    "\n/offers - Send all current offers once (only from the categories you are subscribed to)"
    "\n/manage - Manage your subscriptions"
    "\n/leave - Leave this bot and delete stored user data"
)
MESSAGE_UNKNOWN_COMMAND = (
    "Sorry, I didn't understand that command. Type /help to see all commands."
)
MESSAGE_USER_NOT_REGISTERED = (
    "You are not registered. Please, register with /start command."
)
MESSAGE_NO_SUBSCRIPTIONS = "You have no subscriptions. Change that with /manage."
MESSAGE_NO_NEW_OFFERS = "No new offers available. I will write you as soon as there are new offers, I promise!"

logger = logging.getLogger(__name__)


class TelegramBot:
    def __init__(self, config: ParsedConfig, session: Session):
        self.config = config
        self.Session = session

    def __enter__(self) -> TelegramBot:
        if self.config.telegram_bot:
            self.start()
        return self

    def __exit__(
        self,
        exc_type: Type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        if self.updater is not None:
            self.stop()

    def start(self) -> None:
        """Start the bot."""
        # Register commands
        bot = telegram.Bot(token=self.config.telegram_access_token)
        bot.set_my_commands(
            [
                telegram.BotCommand("start", "Register and start the bot"),
                telegram.BotCommand("help", "Show available commands"),
                telegram.BotCommand("manage", "Manage your subscriptions"),
                telegram.BotCommand("status", "Show your status"),
            ]
        )

        self.updater = Updater(token=self.config.telegram_access_token)
        dispatcher = self.updater.dispatcher

        logger.info("Telegram Bot: Initialized")

        dispatcher.add_handler(CommandHandler("start", self.start_command))
        dispatcher.add_handler(CommandHandler("leave", self.leave_command))
        dispatcher.add_handler(CommandHandler("help", self.help_command))
        dispatcher.add_handler(CommandHandler("manage", self.manage_command))
        dispatcher.add_handler(CommandHandler("status", self.status_command))
        dispatcher.add_handler(CommandHandler("offers", self.offers_command))
        dispatcher.add_handler(CommandHandler("debug", self.debug_command))
        dispatcher.add_handler(CommandHandler("error", self.error_command))

        dispatcher.add_handler(
            CallbackQueryHandler(self.toggle_subscription_callback, pattern="toggle")
        )
        dispatcher.add_handler(
            CallbackQueryHandler(self.offer_details_callback, pattern="details")
        )
        dispatcher.add_handler(
            CallbackQueryHandler(self.close_menu_callback, pattern="close menu")
        )

        dispatcher.add_handler(MessageHandler(Filters.command, self.unknown))
        dispatcher.add_error_handler(self.error_handler)

        logger.info("Telegram Bot: Starting polling")
        self.updater.start_polling()  # Starts in a different thread

    def stop(self) -> None:
        """Stop the bot."""
        logger.info("Telegram Bot: Stopping polling")
        self.updater.stop()

    def error_handler(self, update: object, context: CallbackContext) -> None:  # type: ignore
        """Log the error and send a telegram message to notify the developer chat."""
        # Log the error before we do anything else, so we can see it even if something breaks.
        logger.error(msg="Exception while handling an update:", exc_info=context.error)

        # We can only continue if we have an actual exception
        if context.error is None:
            return

        exception_type = str(type(context.error))

        # Common case when a user clicks too fast on the "show details" button.
        # Nothing to do here, not an actual error.
        if isinstance(
            context.error, telegram.error.BadRequest
        ) and context.error.message.startswith("Message is not modified: "):
            return

        # Network instability causes that probably fix themselves.
        if isinstance(context.error, RemoteDisconnected) or (
            isinstance(context.error, telegram.error.NetworkError)
            and not isinstance(context.error, telegram.error.BadRequest)
        ):
            logger.error(str(context.error))
            try:
                message = (
                    markdown_escape(
                        "Common error encountered, probably will fix itself. See log file for details."
                    )
                    + "\n"
                    + "```\n"
                    + markdown_escape(exception_type + ": " + str(context.error))
                    + "\n```"
                )
                self.send_message(
                    chat_id=Config.get().telegram_developer_chat_id,
                    text=message,
                    parse_mode=telegram.ParseMode.MARKDOWN_V2,
                )
                return
            except (
                RemoteDisconnected,
                TelegramError,
                telegram.error.NetworkError,
                HTTPError,
            ):
                logger.error(
                    "Failed to send message to developer chat (probably network or Telegram is down)."
                )
                return

        # Multiple bot instances, abort to avoid Telegram punishing API key misuse!
        if isinstance(
            context.error, telegram.TelegramError
        ) and context.error.message.startswith("Conflict: "):
            error_text = "Multiple instances of the same bot running, shutting down myself to avoid further conflicts."
            logger.error(error_text)
            self.send_message(
                chat_id=Config.get().telegram_developer_chat_id,
                text=error_text,
                parse_mode=None,
            )
            # Stop the bot.. and the whole application with it.
            # Do *not* call self.updater.stop() here as it doesn't persist.
            # See https://github.com/python-telegram-bot/python-telegram-bot/issues/801#issuecomment-570945590
            # TODO: Restart the bot instead of exiting the application.
            bot_pid = os.getpid()
            os.kill(bot_pid, signal.SIGINT)
            return

        # This happens when the bot is removed from the group chat.
        # TODO: Also remove the user from the database.
        if (
            isinstance(context.error, telegram.TelegramError)
            and context.error.message == "Unauthorized"
        ):
            error_text = "Could not send to chat, unauthorized."
            logger.error(error_text)
            self.send_message(
                chat_id=Config.get().telegram_developer_chat_id,
                text=error_text,
                parse_mode=None,
            )
            return

        # Build the exception string from the exception
        traceback_string = "".join(
            traceback.format_exception(None, context.error, context.error.__traceback__)
        )

        # Get some additional information about what happened.
        update_str = update.to_dict() if isinstance(update, Update) else str(update)

        # Put it all together in the message
        full_debug_message = (
            f"An exception was raised while handling an update:\n\n"
            f"update = {json.dumps(update_str, indent=2, ensure_ascii=False)}\n\n"
        )
        if context.chat_data:
            full_debug_message += f"context.chat_data = {str(context.chat_data)}\n\n"
        if context.user_data:
            full_debug_message += f"context.user_data = {str(context.user_data)}\n\n"
        full_debug_message += f"traceback = {traceback_string}"

        logger.error(full_debug_message)

        # Max message length is 4096, so we need to split it up. We use 3000 to
        # be on the safe side and have room for some markdown wrapping.
        message_in_chunks = chunkstring(full_debug_message, 3000)

        for chunk in message_in_chunks:
            message = "```\n" + (markdown_escape(chunk)) + "\n```"
            self.send_message(
                chat_id=Config.get().telegram_developer_chat_id,
                text=message,
                parse_mode=telegram.ParseMode.MARKDOWN_V2,
            )

    def error_command(self, update: Update, context: CallbackContext) -> None:  # type: ignore
        """Handle the /error command: Trigger an error to send to the dev chat."""
        self.log_call(update)

        raise Exception("This is a test error triggered by the /error command.")

    def manage_command(self, update: Update, context: CallbackContext) -> None:  # type: ignore
        """Handle the /manage command: Manage subscriptions."""
        self.log_call(update)

        if update.message is None or update.effective_user is None:
            return

        db_user = self.get_user(update.effective_user.id)
        if db_user is None:
            update.message.reply_text(MESSAGE_USER_NOT_REGISTERED)
            return

        update.message.reply_text(
            MESSAGE_MANAGE_MENU,
            reply_markup=self.manage_menu_keyboard(db_user),
        )

    def offers_command(self, update: Update, context: CallbackContext) -> None:  # type: ignore
        """Handle the /offers command: Send all subscriptions once."""
        self.log_call(update)

        if update.message is None or update.effective_user is None:
            return

        db_user = self.get_user(update.effective_user.id)
        if db_user is None:
            update.message.reply_text(MESSAGE_USER_NOT_REGISTERED)
            return

        if (
            db_user.telegram_subscriptions is None
            or len(db_user.telegram_subscriptions) == 0
        ):
            update.message.reply_text(MESSAGE_NO_SUBSCRIPTIONS)
            return

        if not self.send_new_offers(db_user):
            update.message.reply_text(MESSAGE_NO_NEW_OFFERS)

    def send_new_offers(self, user: User) -> bool:
        """Send all new offers for the user."""

        subscriptions = user.telegram_subscriptions

        offers_sent = 0
        subscription: TelegramSubscription
        session: Session = self.Session()
        for subscription in subscriptions:
            offers: list[Offer] = (
                session.execute(
                    select(Offer).where(
                        and_(
                            Offer.type == subscription.type,
                            Offer.source == subscription.source,
                            Offer.duration == subscription.duration,
                            Offer.id > subscription.last_offer_id,
                            # Only send offers that are already active
                            or_(
                                Offer.valid_from <= datetime.now().replace(tzinfo=None),  # type: ignore
                                Offer.valid_from == None,  # noqa: E711
                            ),
                            # Only send offers that are either:
                            # - valid at this point of time
                            # - have no start and end date and have been first seen in the last 7 days
                            or_(
                                Offer.valid_to >= datetime.now().replace(tzinfo=None),  # type: ignore
                                and_(
                                    Offer.valid_from == None,  # noqa: E711
                                    Offer.valid_to == None,  # noqa: E711
                                    Offer.seen_first
                                    >= datetime.now().replace(tzinfo=timezone.utc)
                                    - timedelta(days=7),
                                ),
                            ),
                        )
                    )
                )
                .scalars()
                .all()
            )

            if len(offers) == 0:
                continue

            offers_sent += len(offers)

            # Send the offers
            for offer in offers:
                self.send_offer(offer, user)

            # Update the last offer id
            subscription.last_offer_id = offers[-1].id
            user.offers_received_count = user.offers_received_count + len(offers)
            session.commit()

        if offers_sent:
            return True
        else:
            return False

    def send_new_announcements(self, user: User) -> None:
        session: Session = self.Session()
        announcements: list[Announcement] = (
            session.execute(
                select(Announcement).where(
                    and_(
                        or_(
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

        # Send the offers
        for announcement in announcements:
            self.send_announcement(announcement, user)

        user.last_announcement_id = announcements[-1].id
        session.commit()

    def debug_command(self, update: Update, context: CallbackContext) -> None:  # type: ignore
        """Handle the /debug command: Show some debug information."""
        self.log_call(update)

        if update.message is None:
            return

        if update.effective_user is not None:
            update.message.reply_markdown_v2(
                markdown_json_formatted(
                    f"update.effective_user = {json.dumps(update.effective_user.to_dict(), indent=2, ensure_ascii=False)}"
                )
            )

        if update.effective_chat is not None:
            update.message.reply_markdown_v2(
                markdown_json_formatted(
                    f"update.effective_chat = {json.dumps(update.effective_chat.to_dict(), indent=2, ensure_ascii=False)}"
                )
            )

    def start_command(self, update: Update, context: CallbackContext) -> None:  # type: ignore
        """Handle the /start command: Register the user and display guide."""
        self.log_call(update)

        if update.message is None or update.effective_user is None:
            return

        welcome_text = (
            R"I belong to the [LootScraper](https://github\.com/eikowagenknecht/lootscraper) project\. "
            R"If you have any issues or feature request, please use the "
            R"[issues](https://github\.com/eikowagenknecht/lootscraper/issues) to report them\. "
            R"And if you like it, please consider "
            R"[⭐ starring it on GitHub](https://github\.com/eikowagenknecht/lootscraper/stargazers)\. "
            R"Thanks\!"
            "\n\n"
            R"*How this works*"
            "\n"
            R"You tell me what kind of offers you want to see with the /manage command\. "
            R"I will then send you a message with all current offers of that kind if you want\. "
            R"I will also send you a message every time a new offer is added\. "
            R"To see the commands you can use to talk to me, type /help now\."
            "\n\n"
            R"*Privacy*"
            "\n"
            R"I need to store some user data \(e\.g\. your Telegram user ID and your subscriptions\) to work\. "
            R"You can leave any time by typing /leave\. "
            R"This instantly deletes all data about you\. "
            R"Also I will be sad to see you go\."
        )

        db_user = self.get_user(update.effective_user.id)

        if db_user is not None:
            message = (
                Rf"Welcome back, {update.effective_user.mention_markdown_v2()} 👋\. "
                + R"You are already registered ❤\. "
                + R"In case you forgot, this was my initial message to you:"
                + "\n\n"
                + welcome_text
            )
            logger.debug(f"Sending /start reply: {message}")
            update.message.reply_markdown_v2(message)
            return

        # Register user if not registered yet
        session: Session = self.Session()
        latest_announcement = session.execute(
            select(func.max(Announcement.id))
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

        message = (
            Rf"Hi {update.effective_user.mention_markdown_v2()} 👋, welcome to the LootScraper Telegram Bot and thank you for registering\!"
            + "\n\n"
            + welcome_text
        )
        logger.debug(f"Sending /start reply: {message}")
        update.message.reply_markdown_v2(message)

        # Notify about the new registration
        if Config.get().telegram_log_level.value >= TelegramLogLevel.DEBUG.value:
            message = (
                Rf"New user {update.effective_user.mention_markdown_v2()} registered\."
            )
            logger.debug(f"Sending user registered message: {message}")
            self.send_message(
                chat_id=Config.get().telegram_developer_chat_id,
                text=message,
                parse_mode=telegram.ParseMode.MARKDOWN_V2,
            )

    def leave_command(self, update: Update, context: CallbackContext) -> None:  # type: ignore
        """Handle the /leave command: Unregister the user."""
        self.log_call(update)

        if update.message is None or update.effective_user is None:
            return

        db_user = self.get_user(update.effective_user.id)

        if db_user is None:
            message = (
                Rf"Hi {update.effective_user.mention_markdown_v2()}, you are currently not registered\. "
                R"So you can't leave ;\-\)"
            )
            logger.debug(f"Sending /leave reply: {message}")
            update.message.reply_markdown_v2(message)
            return

        # Delete user from database (if registered)
        session: Session = self.Session()
        session.delete(db_user)
        session.commit()

        message = (
            Rf"Bye {update.effective_user.mention_markdown_v2()}, I'm sad to see you go\. "
            R"Your user data has been deleted\. "
            R"If you want to come back at any time, just type /start\!"
        )
        logger.debug(f"Sending /leave reply: {message}")
        update.message.reply_markdown_v2(message)

    def help_command(self, update: Update, context: CallbackContext) -> None:  # type: ignore
        """Handle the /help command: Display all available commands to the user."""
        self.log_call(update)

        if update.message is None:
            return

        update.message.reply_markdown_v2(MESSAGE_HELP)

    def status_command(self, update: Update, context: CallbackContext) -> None:  # type: ignore
        """Handle the /status command: Display some statistics about the user."""
        self.log_call(update)

        if not update.effective_chat or not update.effective_user or not update.message:
            return

        db_user = self.get_user(update.effective_user.id)
        if db_user is None:
            message = (
                Rf"Hi {update.effective_user.mention_markdown_v2()}, you are currently not registered\. "
                R"So there is no data stored about you\. "
                R"But I'd be happy to see you register any time with the /start command\!"
            )
            logger.debug(f"Sending /status reply: {message}")
            update.message.reply_markdown_v2(message)
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
                subscriptions_text += (
                    Rf"\* {subscription.source.value} \({subscription.type.value}\)"
                    + "\n"
                )
            subscriptions_text += (
                R"You can unsubscribe from them any time with /manage\."
            )
        else:
            subscriptions_text = (
                R"\- You are currently not subscribed to any categories\. "
                R"You can change that with the /manage command if you wish\."
            )

        message = (
            Rf"Hi {update.effective_user.mention_markdown_v2()}, you are currently registered\. "
            R"But I'm not storing much user data, so this is all I know about you: "
            "\n\n"
            Rf"\- You registered on {markdown_escape(db_user.registration_date.strftime(TIMESTAMP_READABLE_WITH_HOUR))} with the /start command\."
            "\n"
            Rf"\- Your Telegram chat id is {db_user.telegram_chat_id}\. "
            R"Neat, huh? I use it to send you notifications\."
            "\n"
            f"{subscriptions_text}"
            "\n"
            Rf"\- You received {db_user.offers_received_count} offers so far\. "
        )
        logger.debug(f"Sending /status reply: {message}")
        update.message.reply_markdown_v2(message)

    def unknown(self, update: Update, context: CallbackContext) -> None:  # type: ignore
        self.log_call(update)

        if not update.effective_chat:
            return

        self.send_message(
            chat_id=update.effective_chat.id,
            text=MESSAGE_UNKNOWN_COMMAND,
            parse_mode=None,
        )

    def get_user(self, telegram_id: int) -> User | None:
        session: Session = self.Session()
        db_user = (
            session.execute(select(User).where(User.telegram_id == telegram_id))
            .scalars()
            .one_or_none()
        )

        return db_user

    def is_subscribed(
        self, user: User, type: OfferType, source: Source, duration: OfferDuration
    ) -> bool:
        session: Session = self.Session()
        subscription = session.execute(
            select(TelegramSubscription).where(
                and_(
                    TelegramSubscription.user_id == user.id,
                    TelegramSubscription.type == type,
                    TelegramSubscription.source == source,
                    TelegramSubscription.duration == duration,
                )
            )
        ).scalar_one_or_none()
        return subscription is not None

    def subscribe(
        self, user: User, type: OfferType, source: Source, duration: OfferDuration
    ) -> None:
        session: Session = self.Session()
        session.add(
            TelegramSubscription(user=user, source=source, type=type, duration=duration)
        )
        session.commit()

    def unsubscribe(
        self, user: User, type: OfferType, source: Source, duration: OfferDuration
    ) -> None:
        session: Session = self.Session()
        session.query(TelegramSubscription).filter(
            and_(
                TelegramSubscription.user_id == user.id,
                TelegramSubscription.type == type,
                TelegramSubscription.source == source,
                TelegramSubscription.duration == duration,
            )
        ).delete()
        session.commit()

    def manage_menu(self, update: Update, context: CallbackContext) -> None:  # type: ignore
        if update.callback_query is None or update.effective_user is None:
            return

        db_user = self.get_user(update.effective_user.id)
        if db_user is None:
            update.callback_query.answer(text=MESSAGE_USER_NOT_REGISTERED)
            return

        update.callback_query.answer()
        update.callback_query.edit_message_text(
            text=MESSAGE_MANAGE_MENU,
            reply_markup=self.manage_menu_keyboard(db_user),
        )

    def manage_menu_keyboard(self, user: User) -> InlineKeyboardMarkup:
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
                    keyboard_button_row(
                        True, scraper_source, scraper_type, scraper_duration
                    )
                )
            else:
                keyboard.append(
                    keyboard_button_row(
                        False, scraper_source, scraper_type, scraper_duration
                    )
                )

        keyboard.append(
            [InlineKeyboardButton(text=BUTTON_CLOSE, callback_data="close menu")]
        )

        return InlineKeyboardMarkup(keyboard)

    def offer_details_show_keyboard(self, offer: Offer) -> InlineKeyboardMarkup:
        keyboard: list[list[InlineKeyboardButton]] = []
        keyboard.append(
            [
                InlineKeyboardButton(
                    text=BUTTON_SHOW_DETAILS, callback_data=f"details show {offer.id}"
                )
            ]
        )
        return InlineKeyboardMarkup(keyboard)

    def offer_details_hide_keyboard(self, offer: Offer) -> InlineKeyboardMarkup:
        keyboard: list[list[InlineKeyboardButton]] = []
        keyboard.append(
            [
                InlineKeyboardButton(
                    text=BUTTON_HIDE_DETAILS, callback_data=f"details hide {offer.id}"
                )
            ]
        )
        return InlineKeyboardMarkup(keyboard)

    def offer_details_callback(self, update: Update, context: CallbackContext) -> None:  # type: ignore
        if update.callback_query is None or update.effective_user is None:
            return

        query = update.callback_query

        if query.data is None:
            return

        offer_id = int(query.data.split(" ")[2])
        session: Session = self.Session()
        offer = session.execute(select(Offer).where(Offer.id == offer_id)).scalar()

        if query.data.startswith("details show"):
            query.answer()
            query.edit_message_text(
                text=self.offer_details_message(offer),
                parse_mode=ParseMode.MARKDOWN_V2,
                reply_markup=self.offer_details_hide_keyboard(offer),
            )
        elif query.data.startswith("details hide"):
            query.answer()
            query.edit_message_text(
                text=self.offer_message(offer),
                parse_mode=ParseMode.MARKDOWN_V2,
                reply_markup=self.offer_details_show_keyboard(offer),
            )

    def close_menu_callback(self, update: Update, context: CallbackContext) -> None:  # type: ignore
        if update.callback_query is None or update.effective_user is None:
            return

        query = update.callback_query

        if query.data != "close menu":
            return

        query.answer(text="Bye!")
        query.edit_message_text(
            text=MESSAGE_MANAGE_MENU_CLOSED,
            reply_markup=None,
        )

    def toggle_subscription_callback(self, update: Update, context: CallbackContext) -> None:  # type: ignore
        query = update.callback_query
        if query is None or update.effective_user is None or query.data is None:
            return

        db_user = self.get_user(update.effective_user.id)
        if db_user is None:
            query.answer(text=MESSAGE_USER_NOT_REGISTERED)
            return

        data = query.data.lower().removeprefix("toggle").strip().upper().split(" ")
        source = Source[data[0]]
        type = OfferType[data[1]]
        duration = OfferDuration[data[2]]

        answer_text = None

        if not self.is_subscribed(db_user, type, source, duration):
            self.subscribe(db_user, type, source, duration)
            answer_text = POPUP_SUBSCRIBED
        else:
            self.unsubscribe(db_user, type, source, duration)
            answer_text = POPUP_UNSUBSCRIBED

        query.answer(text=answer_text)
        query.edit_message_text(
            text=MESSAGE_MANAGE_MENU,
            reply_markup=self.manage_menu_keyboard(db_user),
        )

    def send_message(self, *args, **kwargs) -> Message | None:  # type: ignore
        """Wrapper around the message sending to handle exceptions."""
        try:
            return self.updater.bot.send_message(*args, **kwargs)
        except TelegramError as e:
            if e.message == "Chat not found":
                # TODO: The user has probably closed the chat. Remove the user from the database.
                # Does the error handler work here?
                pass
            else:
                logger.error(e)
            return None

    def send_offer(self, offer: Offer, user: User) -> bool:
        logger.debug(
            f"Sending offer {offer.title} to Telegram user {user.telegram_id}. Markdown: {self.offer_message(offer)}"
        )

        markup = None
        if offer.game and (offer.game.igdb_info or offer.game.steam_info):
            markup = self.offer_details_show_keyboard(offer)

        return (
            self.send_message(
                chat_id=user.telegram_chat_id,
                text=self.offer_message(offer),
                parse_mode=ParseMode.MARKDOWN_V2,
                reply_markup=markup,
            )
            is not None
        )

    def send_announcement(self, announcement: Announcement, user: User) -> None:
        logger.debug(
            f"Sending announcement {announcement.id} to Telegram user {user.telegram_id}. Markdown: {announcement.text_markdown}"
        )
        self.send_message(
            chat_id=user.telegram_chat_id,
            text=announcement.text_markdown,
            parse_mode=ParseMode.MARKDOWN_V2,
            reply_markup=None,
        )

    def offer_message(self, offer: Offer) -> str:
        source = offer.source.value
        additional_info = offer.type.value
        if offer.duration != OfferDuration.CLAIMABLE:
            additional_info += f", {offer.duration.value}"

        content = markdown_bold(f"{source} ({additional_info}) - {offer.title}")

        if offer.img_url:
            content += " " + markdown_url(offer.img_url, f"[{offer.id}]")
        elif offer.game and offer.game.steam_info and offer.game.steam_info.image_url:
            content += " " + markdown_url(
                offer.game.steam_info.image_url, f"[{offer.id}]"
            )
        else:
            content += f" [{offer.id}]"

        content += "\n\n"

        if offer.valid_to:
            time_to_end = humanize.naturaldelta(
                datetime.now().replace(tzinfo=timezone.utc) - offer.valid_to
            )
            if datetime.now().replace(tzinfo=timezone.utc) > offer.valid_to:
                content += f"Offer expired {markdown_escape(time_to_end)} ago"
            else:
                content += f"Offer expires in {markdown_escape(time_to_end)}"
            content += markdown_escape(
                " (" + offer.valid_to.strftime(TIMESTAMP_READABLE_WITH_HOUR) + ")."
            )
        elif offer.duration == OfferDuration.ALWAYS:
            content += markdown_escape("Offer will stay free, no need to hurry.")
        else:
            content += markdown_escape(
                "Offer is valid forever.. just kidding, I just don't know when it will end."
            )

        if offer.url:
            content += " " + markdown_url(
                offer.url, f"Claim it now for free on {offer.source.value}!"
            )

        return content

    def offer_details_message(self, offer: Offer) -> str:
        content = self.offer_message(offer)

        if offer.game:
            game: Game = offer.game

            content += "\n\n__About the game__\n\n"
            if game.igdb_info and game.igdb_info.name:
                content += Rf"*Name:* {markdown_escape(game.igdb_info.name)}" + "\n\n"
            elif game.steam_info and game.steam_info.name:
                content += Rf"*Name:* {markdown_escape(game.steam_info.name)}" + "\n\n"

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
                ratings_str = f"*Ratings:* {' / '.join(ratings)}\n\n"
                content += ratings_str
            if game.igdb_info and game.igdb_info.release_date:
                content += f"*Release date:* {markdown_escape(game.igdb_info.release_date.strftime(TIMESTAMP_SHORT))}\n\n"
            elif game.steam_info and game.steam_info.release_date:
                content += f"*Release date:* {markdown_escape(game.steam_info.release_date.strftime(TIMESTAMP_SHORT))}\n\n"
            if game.steam_info and game.steam_info.recommended_price_eur:
                content += (
                    Rf"*Recommended price \(Steam\):* {markdown_escape(str(game.steam_info.recommended_price_eur))} EUR"
                    + "\n\n"
                )
            if game.igdb_info and game.igdb_info.short_description:
                content += f"*Description:* {markdown_escape(game.igdb_info.short_description)}\n\n"
            elif game.steam_info and game.steam_info.short_description:
                content += f"*Description:* {markdown_escape(game.steam_info.short_description)}\n\n"
            if game.steam_info and game.steam_info.genres:
                content += f"*Genres:* {markdown_escape(game.steam_info.genres)}\n\n"
            content += R"\* Any information about the offer is automatically grabbed and may in rare cases not match the correct game\."

        return content

    def log_call(self, update: Update) -> None:
        if Config.get().telegram_log_level.value >= TelegramLogLevel.DEBUG.value:
            message = "Received command: "
            if update.effective_user:
                message += f"User {update.effective_user.mention_markdown_v2()}"
            if update.effective_message:
                message += f", Message {update.effective_message.text_markdown_v2}"
            logger.debug(message)
            self.send_message(
                chat_id=Config.get().telegram_developer_chat_id,
                text=message,
                parse_mode=telegram.ParseMode.MARKDOWN_V2,
            )


def markdown_json_formatted(input: str) -> str:
    return f"```json\n{input}\n```"


def keyboard_button_row(
    active: bool,
    source: Source,
    offer_type: OfferType,
    offer_duration: OfferDuration,
) -> list[InlineKeyboardButton]:
    is_subscribed_str = " - subscribed" if active else ""
    source_str = f"{source.value} {offer_type.value}"
    if offer_duration != OfferDuration.CLAIMABLE:
        source_str += f" ({offer_duration.value})"
    command = f"toggle {source.name} {offer_type.name} {offer_duration.name}"

    return [
        InlineKeyboardButton(f"{source_str}{is_subscribed_str}", callback_data=command)
    ]

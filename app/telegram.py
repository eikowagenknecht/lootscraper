from __future__ import annotations

import html
import json
import logging
import traceback
from datetime import datetime, timezone, timedelta
from types import TracebackType
from typing import Type

import humanize
import telegram
from sqlalchemy import or_, select
from sqlalchemy.orm import Session
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, ParseMode, Update
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
    OfferType,
    Source,
)
from app.configparser import Config, ParsedConfig
from app.sqlalchemy import Game, Offer, TelegramSubscription, User, and_

logger = logging.getLogger(__name__)


class TelegramBot:
    def __init__(self, config: ParsedConfig, session: Session):
        self.config = config
        self.session = session

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
                telegram.BotCommand("start", "Start the bot"),
                telegram.BotCommand("help", "Show help"),
                telegram.BotCommand("manage", "Edit your subscriptions"),
                telegram.BotCommand("status", "Show your subscriptions"),
            ]
        )

        self.updater = Updater(token=self.config.telegram_access_token)
        dispatcher = self.updater.dispatcher

        logging.info("Telegram Bot: Initialized")

        dispatcher.add_handler(CommandHandler("start", self.start_command))
        dispatcher.add_handler(CommandHandler("leave", self.leave_command))
        dispatcher.add_handler(CommandHandler("help", self.help_command))
        dispatcher.add_handler(CommandHandler("manage", self.manage_command))
        dispatcher.add_handler(CommandHandler("status", self.status_command))
        dispatcher.add_handler(CommandHandler("offers", self.offers_command))
        dispatcher.add_handler(CommandHandler("debug", self.debug_command))

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

        logging.info("Telegram Bot: Starting polling")
        self.updater.start_polling()  # Starts in a different thread

    def stop(self) -> None:
        """Stop the bot."""
        logging.info("Telegram Bot: Stopping polling")
        self.updater.stop()

    def error_handler(self, update: object, context: CallbackContext) -> None:  # type: ignore
        """Log the error and send a telegram message to notify the developer chat."""
        # Log the error before we do anything else, so we can see it even if something breaks.
        logger.error(msg="Exception while handling an update:", exc_info=context.error)

        # We can only continue if we have an actual exception
        if context.error is None:
            return

        # traceback.format_exception returns the usual python message about an exception, but as a
        # list of strings rather than a single string, so we have to join them together.
        tb_list = traceback.format_exception(
            None, context.error, context.error.__traceback__
        )
        tb_string = "".join(tb_list)

        # Build the message with some markup and additional information about what happened.
        # TODO: Might need to add some logic to deal with messages longer than the 4096 character limit.
        update_str = update.to_dict() if isinstance(update, Update) else str(update)
        message_pt1 = (
            f"An exception was raised while handling an update:\n\n"
            f"<pre>update = {html.escape(json.dumps(update_str, indent=2, ensure_ascii=False))}"
            "</pre>\n\n"
            f"<pre>context.chat_data = {html.escape(str(context.chat_data))}</pre>\n\n"
            f"<pre>context.user_data = {html.escape(str(context.user_data))}</pre>\n\n"
        )

        message_pt2 = f"<pre>{html.escape(tb_string)}</pre>"

        logging.error(message_pt1 + message_pt2)
        if len(message_pt1) + len(message_pt2) < 4096:
            message = message_pt1 + message_pt2
            context.bot.send_message(
                chat_id=Config.get().telegram_developer_chat_id,
                text=message,
                parse_mode=ParseMode.HTML,
            )
        else:
            if len(message_pt1) < 4096:
                # Finally, send the message
                context.bot.send_message(
                    chat_id=Config.get().telegram_developer_chat_id,
                    text=message_pt1,
                    parse_mode=ParseMode.HTML,
                )
            if len(message_pt2) < 4096:
                context.bot.send_message(
                    chat_id=Config.get().telegram_developer_chat_id,
                    text=message_pt2,
                    parse_mode=ParseMode.HTML,
                )

        if len(message_pt1) >= 4096 and len(message_pt2) >= 4096:
            context.bot.send_message(
                chat_id=Config.get().telegram_developer_chat_id,
                text="There was an error, but the message is too long to send.",
                parse_mode=ParseMode.HTML,
            )

        # TODO: Do some more specific error handling here:
        # - If the user blacked our bot, remove him from the database
        if isinstance(context.error, telegram.TelegramError):
            if context.error.message == "Unauthorized":
                pass
            pass

    def manage_command(self, update: Update, context: CallbackContext) -> None:  # type: ignore
        """Handle the /manage command: Manage subscriptions."""
        if update.message is None or update.effective_user is None:
            return

        db_user = self.get_user(update.effective_user.id)
        if db_user is None:
            update.message.reply_markdown_v2(
                "You are not registered. Please, register with /start command."
            )
            return

        update.message.reply_text(
            self.manage_menu_message(), reply_markup=self.manage_menu_keyboard(db_user)
        )

    def offers_command(self, update: Update, context: CallbackContext) -> None:  # type: ignore
        """Handle the /offers command: Send all subscriptions once."""
        if update.message is None or update.effective_user is None:
            return

        db_user = self.get_user(update.effective_user.id)
        if db_user is None:
            update.message.reply_markdown_v2(
                "You are not registered. Please, register with /start command."
            )
            return

        if (
            db_user.telegram_subscriptions is None
            or len(db_user.telegram_subscriptions) == 0
        ):
            update.message.reply_markdown_v2(
                "You have no subscriptions\\. Change that with /manage\\."
            )
            return

        if not self.send_new_offers(db_user):
            update.message.reply_markdown_v2(
                "No new offers available\\. I will write you as soon as there are new offers, I promise\\!"
            )

    def send_new_offers(self, user: User) -> bool:
        """Send all new offers for the user."""

        subscriptions = user.telegram_subscriptions

        offers_sent = 0
        subscription: TelegramSubscription
        for subscription in subscriptions:
            offers: list[Offer] = (
                self.session.execute(
                    select(Offer).where(
                        and_(
                            Offer.type == subscription.type,
                            Offer.source == subscription.source,
                            Offer.id > subscription.last_offer_id,
                            or_(
                                Offer.valid_from <= datetime.now().replace(tzinfo=None),  # type: ignore
                                Offer.valid_from == None,  # noqa: E711
                            ),
                            or_(
                                Offer.valid_to >= datetime.now().replace(tzinfo=None),  # type: ignore
                                and_(
                                    Offer.valid_from == None,  # noqa: E711
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
            self.session.commit()

        if offers_sent:
            return True
        else:
            return False

    def debug_command(self, update: Update, context: CallbackContext) -> None:  # type: ignore
        """Handle the /debug command: Show some debug information."""
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
            update.message.reply_markdown_v2(
                Rf"Welcome back, {update.effective_user.mention_markdown_v2()} 👋\. "
                + R"You are already registered ❤\. "
                + R"In case you forgot, this was my initial message to you:"
                + "\n\n"
                + welcome_text,
            )
            return

        # Register user if not registered yet
        new_user = User(
            telegram_id=update.effective_user.id,
            telegram_chat_id=update.effective_chat.id
            if update.effective_chat
            else None,
            telegram_user_details=update.effective_user.to_json(),
            registration_date=datetime.now().replace(tzinfo=timezone.utc),
        )
        self.session.add(new_user)
        self.session.commit()

        update.message.reply_markdown_v2(
            Rf"Hi {update.effective_user.mention_markdown_v2()} 👋, welcome to the LootScraper Telegram Bot and thank you for registering\!"
            + "\n\n"
            + welcome_text,
        )

    def leave_command(self, update: Update, context: CallbackContext) -> None:  # type: ignore
        """Handle the /leave command: Unregister the user."""
        if update.message is None or update.effective_user is None:
            return

        db_user = self.get_user(update.effective_user.id)

        if db_user is None:
            update.message.reply_markdown_v2(
                (
                    Rf"Hi {update.effective_user.mention_markdown_v2()}, you are currently not registered\. "
                    R"So you can't leave ;\-\)"
                ),
            )
            return

        # Delete user from database (if registered)
        self.session.delete(db_user)
        self.session.commit()

        update.message.reply_markdown_v2(
            (
                Rf"Bye {update.effective_user.mention_markdown_v2()}, I'm sad to see you go\. "
                R"Your user data has been deleted\. "
                R"If you want to come back at any time, just type /start to start again\!"
            ),
        )

    def help_command(self, update: Update, context: CallbackContext) -> None:  # type: ignore
        """Handle the /help command: Display all available commands to the user."""
        if update.message is None:
            return

        update.message.reply_markdown_v2(
            (
                R"*Available commands*"
                "\n"
                R"/start \- Start the bot \(you already did that\)"
                "\n"
                R"/help \- Show this help message"
                "\n"
                R"/status \- Show information about your subscriptions"
                "\n"
                R"/offers \- Send all current offers once \(only from the categories you are subscribed to\)"
                "\n"
                R"/manage \- Manage your subscriptions"
                "\n"
                R"/leave \- Leave this bot and delete stored user data"
            )
        )

    def status_command(self, update: Update, context: CallbackContext) -> None:  # type: ignore
        """Handle the /status command: Display some statistics about the user."""
        if not update.effective_chat or not update.effective_user or not update.message:
            return

        db_user = self.get_user(update.effective_user.id)
        if db_user is None:
            update.message.reply_markdown_v2(
                Rf"Hi {update.effective_user.mention_markdown_v2()}, you are currently not registered\. "
                R"So there is no data stored about you\. "
                R"But I'd be happy to see you register any time with the /start command\!"
            )
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
                R"\- You are currently not subscribed to any categories\."
                R"\- You can change that with the /manage command if you wish\."
            )

        update.message.reply_markdown_v2(
            Rf"Hi {update.effective_user.mention_markdown_v2()}, you are currently registered\. "
            R"But I'm not storing much user data, so this is all I know about you: "
            "\n\n"
            Rf"\- You registered on {markdown_escape(db_user.registration_date.strftime(TIMESTAMP_READABLE_WITH_HOUR))} with the /start command\."
            "\n"
            Rf"\- Your Telegram chat id is {db_user.telegram_chat_id}\. "
            R"Neat, huh? "
            R"I use it to send you notifications\."
            "\n"
            f"{subscriptions_text}"
            "\n"
            Rf"\- You received {db_user.offers_received_count} offers so far\. "
        )

    def unknown(self, update: Update, context: CallbackContext) -> None:  # type: ignore
        if not update.effective_chat:
            return

        context.bot.send_message(
            chat_id=update.effective_chat.id,
            text="Sorry, I didn't understand that command. Type /help to see all commands.",
        )

    def get_user(self, telegram_id: int) -> User | None:
        db_user = (
            self.session.execute(select(User).where(User.telegram_id == telegram_id))
            .scalars()
            .one_or_none()
        )

        return db_user

    def is_subscribed(self, user: User, type: OfferType, source: Source) -> bool:
        subscription = self.session.execute(
            select(TelegramSubscription).where(
                and_(
                    TelegramSubscription.user_id == user.id,
                    TelegramSubscription.type == type,
                    TelegramSubscription.source == source,
                )
            )
        ).scalar_one_or_none()
        return subscription is not None

    def subscribe(self, user: User, type: OfferType, source: Source) -> None:
        self.session.add(TelegramSubscription(user=user, source=source, type=type))
        self.session.commit()

    def unsubscribe(self, user: User, type: OfferType, source: Source) -> None:
        self.session.query(TelegramSubscription).filter(
            and_(
                TelegramSubscription.user_id == user.id,
                TelegramSubscription.type == type,
                TelegramSubscription.source == source,
            )
        ).delete()
        self.session.commit()

    def manage_menu(self, update: Update, context: CallbackContext) -> None:  # type: ignore
        if update.callback_query is None or update.effective_user is None:
            return

        db_user = self.get_user(update.effective_user.id)
        if db_user is None:
            update.callback_query.answer(
                text="You are not registered. Please, register with /start command."
            )
            return

        update.callback_query.answer()
        update.callback_query.edit_message_text(
            text=self.manage_menu_message(),
            reply_markup=self.manage_menu_keyboard(db_user),
        )

    def manage_menu_message(self) -> str:
        return (
            "Here you can manage your subscriptions. "
            "To do so, just click the following buttons to subscribe / unsubscribe. "
        )

    def manage_menu_close_message(self) -> str:
        return (
            "Thank you for managing your subscriptions. "
            "Forgot something? "
            "You can continue any time with /manage. "
            "If you want me to send you all current offers of your subscriptions, you can type /offers now or any time later."
        )

    def manage_menu_keyboard(self, user: User) -> InlineKeyboardMarkup:
        keyboard: list[list[InlineKeyboardButton]] = []

        if any(
            x.source == Source.AMAZON and x.type == OfferType.GAME
            for x in user.telegram_subscriptions
        ):
            keyboard.append(keyboard_button_row(True, Source.AMAZON, OfferType.GAME))
        else:
            keyboard.append(keyboard_button_row(False, Source.AMAZON, OfferType.GAME))

        if any(
            x.source == Source.AMAZON and x.type == OfferType.LOOT
            for x in user.telegram_subscriptions
        ):
            keyboard.append(keyboard_button_row(True, Source.AMAZON, OfferType.LOOT))
        else:
            keyboard.append(keyboard_button_row(False, Source.AMAZON, OfferType.LOOT))

        if any(
            x.source == Source.EPIC and x.type == OfferType.GAME
            for x in user.telegram_subscriptions
        ):
            keyboard.append(keyboard_button_row(True, Source.EPIC, OfferType.GAME))
        else:
            keyboard.append(keyboard_button_row(False, Source.EPIC, OfferType.GAME))

        if any(
            x.source == Source.GOG and x.type == OfferType.GAME
            for x in user.telegram_subscriptions
        ):
            keyboard.append(keyboard_button_row(True, Source.GOG, OfferType.GAME))
        else:
            keyboard.append(keyboard_button_row(False, Source.GOG, OfferType.GAME))

        if any(
            x.source == Source.STEAM and x.type == OfferType.GAME
            for x in user.telegram_subscriptions
        ):
            keyboard.append(keyboard_button_row(True, Source.STEAM, OfferType.GAME))
        else:
            keyboard.append(keyboard_button_row(False, Source.STEAM, OfferType.GAME))

        keyboard.append(
            [InlineKeyboardButton(text="Close", callback_data="close menu")]
        )

        return InlineKeyboardMarkup(keyboard)

    def offer_details_keyboard(self, offer: Offer) -> InlineKeyboardMarkup:
        keyboard: list[list[InlineKeyboardButton]] = []
        keyboard.append(
            [
                InlineKeyboardButton(
                    text="Show details", callback_data=f"details {offer.id}"
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

        offer_id = int(query.data.split(" ")[1])
        offer = self.session.execute(select(Offer).where(Offer.id == offer_id)).scalar()

        query.answer()
        query.edit_message_text(
            text=self.offer_details_message(offer),
            parse_mode=ParseMode.MARKDOWN_V2,
            reply_markup=None,
        )

    def close_menu_callback(self, update: Update, context: CallbackContext) -> None:  # type: ignore
        if update.callback_query is None or update.effective_user is None:
            return

        query = update.callback_query

        if query.data != "close menu":
            return

        query.answer(text="Bye!")
        query.edit_message_text(
            text=self.manage_menu_close_message(),
            reply_markup=None,
        )

    def toggle_subscription_callback(self, update: Update, context: CallbackContext) -> None:  # type: ignore
        query = update.callback_query
        if query is None or update.effective_user is None or query.data is None:
            return

        db_user = self.get_user(update.effective_user.id)
        if db_user is None:
            query.answer(
                text="You are not registered. Please, register with /start command."
            )
            return

        subscription_type = query.data.lower().removeprefix("toggle").strip()

        answer_text = None

        if subscription_type == "amazon game":
            if not self.is_subscribed(db_user, OfferType.GAME, Source.AMAZON):
                self.subscribe(db_user, OfferType.GAME, Source.AMAZON)
                answer_text = answer(True, Source.AMAZON, OfferType.GAME)
            else:
                self.unsubscribe(db_user, OfferType.GAME, Source.AMAZON)
                answer_text = answer(False, Source.AMAZON, OfferType.GAME)
        elif subscription_type == "amazon loot":
            if not self.is_subscribed(db_user, OfferType.LOOT, Source.AMAZON):
                self.subscribe(db_user, OfferType.LOOT, Source.AMAZON)
                answer_text = answer(True, Source.AMAZON, OfferType.LOOT)
            else:
                self.unsubscribe(db_user, OfferType.LOOT, Source.AMAZON)
                answer_text = answer(False, Source.AMAZON, OfferType.LOOT)
        elif subscription_type == "epic game":
            if not self.is_subscribed(db_user, OfferType.GAME, Source.EPIC):
                self.subscribe(db_user, OfferType.GAME, Source.EPIC)
                answer_text = answer(True, Source.EPIC, OfferType.GAME)
            else:
                self.unsubscribe(db_user, OfferType.GAME, Source.EPIC)
                answer_text = answer(False, Source.EPIC, OfferType.GAME)
        elif subscription_type == "gog game":
            if not self.is_subscribed(db_user, OfferType.GAME, Source.GOG):
                self.subscribe(db_user, OfferType.GAME, Source.GOG)
                answer_text = answer(True, Source.GOG, OfferType.GAME)
            else:
                self.unsubscribe(db_user, OfferType.GAME, Source.GOG)
                answer_text = answer(False, Source.GOG, OfferType.GAME)
        elif subscription_type == "steam game":
            if not self.is_subscribed(db_user, OfferType.GAME, Source.STEAM):
                self.subscribe(db_user, OfferType.GAME, Source.STEAM)
                answer_text = answer(True, Source.STEAM, OfferType.GAME)
            else:
                self.unsubscribe(db_user, OfferType.GAME, Source.STEAM)
                answer_text = answer(False, Source.STEAM, OfferType.GAME)

        query.answer(text=answer_text)
        query.edit_message_text(
            text=self.manage_menu_message(),
            reply_markup=self.manage_menu_keyboard(db_user),
        )

    def send_offer(self, offer: Offer, user: User) -> None:
        self.updater.bot.send_message(
            chat_id=user.telegram_chat_id,
            text=self.offer_message(offer),
            parse_mode=ParseMode.MARKDOWN_V2,
            reply_markup=self.offer_details_keyboard(offer),
        )

    def offer_message(self, offer: Offer) -> str:
        content = Rf"*{offer.source.value} \({offer.type.value}\) \- {markdown_escape(offer.title)}*"

        if offer.img_url:
            content += " " + markdown_url(offer.img_url, f"[{offer.id}]")
        elif offer.game and offer.game.steam_info and offer.game.steam_info.image_url:
            content += " " + markdown_url(
                offer.game.steam_info.image_url, f"[{offer.id}]"
            )
        else:
            content += f" [{offer.id}]"

        if offer.valid_to:
            time_to_end = humanize.naturaldelta(
                datetime.now().replace(tzinfo=timezone.utc) - offer.valid_to
            )
            if datetime.now().replace(tzinfo=timezone.utc) > offer.valid_to:
                content += f"\nOffer expired {markdown_escape(time_to_end)} ago"
            else:
                content += f"\nOffer expires in {markdown_escape(time_to_end)}"
            content += f" \\({markdown_escape(offer.valid_to.strftime(TIMESTAMP_READABLE_WITH_HOUR))}\\)\\."
        else:
            content += "\nOffer is valid forever\\.\\. just kidding, we just don't know when it will end, so grab it now\\!"

        if offer.url:
            content += (
                "Claim it now for free on "
                + markdown_url(offer.url, offer.source.value)
                + R"\!"
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


def markdown_json_formatted(input: str) -> str:
    return f"```json\n{input}\n```"


def keyboard_button_row(
    active: bool,
    source: Source,
    offer_type: OfferType,
) -> list[InlineKeyboardButton]:
    button_state = " - subscribed" if active else ""
    source_str = f"{source.value} ({offer_type.value})"
    command = f"toggle {source.name} {offer_type.name}"

    return [InlineKeyboardButton(f"{source_str}{button_state}", callback_data=command)]


def answer(new_state: bool, source: Source, offer_type: OfferType) -> str:
    source_str = f"{source.value} ({offer_type.value})"
    if new_state:
        return f"Congratulations! You are now subscribed to {source_str} offers."
    else:
        return f"You are now unsubscribed from {source_str} offers."


def markdown_escape(input: str) -> str:
    return (
        input.replace("_", "\\_")
        .replace("*", "\\*")
        .replace("[", "\\[")
        .replace("]", "\\]")
        .replace("(", "\\(")
        .replace(")", "\\)")
        .replace("~", "\\~")
        .replace("`", "\\`")
        .replace(">", "\\>")
        .replace("#", "\\#")
        .replace("+", "\\+")
        .replace("-", "\\-")
        .replace("=", "\\=")
        .replace("|", "\\|")
        .replace("{", "\\{")
        .replace("}", "\\}")
        .replace(".", "\\.")
        .replace("!", "\\!")
    )


def markdown_url(url: str, text: str) -> str:
    return Rf"[{markdown_escape(text)}]({markdown_escape(url)})"

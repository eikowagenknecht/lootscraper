from importlib.metadata import entry_points
from time import sleep

import telegram
from app.configparser import Config
from telegram.ext import Updater
import logging
from telegram import InlineKeyboardMarkup, KeyboardButton, Update, InlineKeyboardButton
from telegram.ext import (
    MessageHandler,
    Filters,
    CommandHandler,
    CallbackContext,
    ConversationHandler,
)


def run_telegram_bot() -> None:
    """Start the bot."""
    cfg_telegram_token: str = Config.config()["telegram"]["AccessToken"]

    # Register commands
    bot = telegram.Bot(token=cfg_telegram_token)
    bot.set_my_commands(
        [
            telegram.BotCommand("start", "Start the bot"),
            telegram.BotCommand("help", "Show help"),
            telegram.BotCommand("subscribe", "Subscribe to offers"),
            telegram.BotCommand("unsubscribe", "Unsubscribe from offers"),
        ]
    )

    updater = Updater(token=cfg_telegram_token)
    dispatcher = updater.dispatcher
    logging.info("Telegram Bot: Initialized")

    dispatcher.add_handler(CommandHandler("start", start_command))
    dispatcher.add_handler(CommandHandler("help", help_command))
    dispatcher.add_handler(CommandHandler("subscribe", subscribe_command))
    dispatcher.add_handler(CommandHandler("unsubscribe", unsubscribe_command))
    dispatcher.add_handler(MessageHandler(Filters.command, unknown))

    # dispatcher.add_error_handler
    logging.info("Telegram Bot: Starting polling")
    updater.start_polling()
    sleep(2)  # For testing only
    logging.info("Telegram Bot: Stopping polling")
    updater.stop()


def start_command(update: Update, context: CallbackContext) -> None:  # type: ignore
    """Send a message when the command /start is issued."""
    if update.message is None or update.effective_user is None:
        return
    try:
        update.message.reply_markdown_v2(
            (
                Rf"Hi {update.effective_user.mention_markdown_v2()}, welcome to the LootScraper Telegram Bot\!"
                "\n\n"
                R"This bot belongs to the [LootScraper](https://github\.com/eikowagenknecht/lootscraper) project\. "
                R"If you have any issues or feature request, please use the "
                R"[Github issues](https://github\.com/eikowagenknecht/lootscraper/issues) to report them\. "
                R"And if you like it, please consider "
                R"[starring it on GitHub](https://github\.com/eikowagenknecht/lootscraper/stargazers)\. "
                R"Thanks\!"
                "\n\n"
                R"*How this works*"
                "\n"
                R"You tell the bot what kind of offers you want to see\. "
                R"The bot will then send you a message with all current offers of that kind\. "
                R"It will also send you a message every time a new offer is added\. "
                R"To see the commands you can use to talk to the bot, type /help now\."
            ),
            # reply_markup=ForceReply(selective=True, input_field_placeholder="/help"),
        )
    except Exception as e:
        logging.error(f"Error in start: {e}")
    pass


def help_command(update: Update, context: CallbackContext) -> None:  # type: ignore
    """Send a message when the command /help is issued."""
    if update.message is None:
        return
    try:
        update.message.reply_markdown_v2(
            (
                R"*Available commands*"
                "\n"
                R"/start \- Start the bot \(you already did that\)"
                "\n"
                R"/help \- Show this help message"
                "\n"
                R"/subscribe _type_ \- Start receiving offers for _type_"
                "\n"
                R"  \- _amazon game_ \- Free games from Amazon"
                "\n"
                R"  \- _amazon loot_ \- Free loot from Amazon"
                "\n"
                R"  \- _epic_ \- Free games from Epic Games"
                "\n"
                R"  \- _steam_ \- Free games from Steam"
                "\n"
                R"  \- _gog_ \- Free games from GOG"
                "\n"
                R"  \- _all_ \- All of the above"
                "\n"
                R"/unsubscribe _type_ \- Stop receiving offers for _type_"
            )
        )
    except Exception as e:
        logging.error(f"Error in help_command: {e}")


def subscribe_command(update: Update, context: CallbackContext) -> None:  # type: ignore
    if not update.effective_chat or not update.message or not update.message.text:
        return
    subscription_type = update.message.text.removeprefix("/subscribe").lower().strip()

    if subscription_type == "":
        update.message.reply_markdown_v2(
            R"Sorry, this command needs a type to work is not a valid subscription type\. Type /help to see all available commands\."
        )
    elif subscription_type == "gog":
        update.message.reply_markdown_v2(
            Rf"Sorry, '{subscription_type}' is not implemented yet\."
        )
    elif subscription_type == "steam":
        update.message.reply_markdown_v2(
            Rf"Sorry, '{subscription_type}' is not implemented yet\."
        )
    elif subscription_type == "epic":
        update.message.reply_markdown_v2(
            Rf"Sorry, '{subscription_type}' is not implemented yet\."
        )
    elif subscription_type == "amazon game":
        update.message.reply_markdown_v2(
            Rf"Sorry, '{subscription_type}' is not implemented yet\."
        )
    elif subscription_type == "amazon loot":
        update.message.reply_markdown_v2(
            Rf"Sorry, '{subscription_type}' is not implemented yet\."
        )
    elif subscription_type == "all":
        update.message.reply_markdown_v2(
            Rf"Sorry, '{subscription_type}' is not implemented yet\."
        )
    else:
        update.message.reply_markdown_v2(
            Rf"Sorry, '{subscription_type}' is not a valid subscription type\. Type /help to see all available commands\."
        )
    pass


def unsubscribe_command(update: Update, context: CallbackContext) -> None:  # type: ignore
    if update.effective_chat:
        text_caps = " ".join(context.args).upper()  # type: ignore
        context.bot.send_message(chat_id=update.effective_chat.id, text=text_caps)


def unknown(update: Update, context: CallbackContext) -> None:  # type: ignore
    if update.effective_chat:
        context.bot.send_message(
            chat_id=update.effective_chat.id,
            text="Sorry, I didn't understand that command. Type /help to see all commands.",
        )


# def send_message_to_user(user_id: int, context: CallbackContext) -> None:
#     context: CallbackContext
#         context.bot.send_message(chat_id=chat.id, text="I'm a bot, please talk to me!")


def build_menu(
    buttons: list[InlineKeyboardButton],
    n_cols: int,
    header_buttons: InlineKeyboardButton | list[InlineKeyboardButton] | None = None,
    footer_buttons: InlineKeyboardButton | list[InlineKeyboardButton] | None = None,
) -> list[list[InlineKeyboardButton]]:
    menu = [buttons[i : i + n_cols] for i in range(0, len(buttons), n_cols)]
    if header_buttons:
        menu.insert(
            0, header_buttons if isinstance(header_buttons, list) else [header_buttons]
        )
    if footer_buttons:
        menu.append(
            footer_buttons if isinstance(footer_buttons, list) else [footer_buttons]
        )
    return menu

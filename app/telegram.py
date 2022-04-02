import html
import json
import logging
import traceback
from time import sleep

import telegram
from telegram import ParseMode, TelegramError, Update
from telegram.ext import (
    CallbackContext,
    CommandHandler,
    Filters,
    MessageHandler,
    Updater,
)

from app.configparser import Config

logger = logging.getLogger(__name__)
cfg_developer_chat: str = Config.config()["telegram"]["DeveloperChatID"]


def run_telegram_bot() -> None:
    """Start the bot."""
    cfg_telegram_token: str = Config.config()["telegram"]["AccessToken"]

    # Register commands
    bot = telegram.Bot(token=cfg_telegram_token)
    bot.set_my_commands(
        [
            telegram.BotCommand("start", "Start the bot"),
            telegram.BotCommand("help", "Show help"),
            telegram.BotCommand("status", "Show your subscriptions"),
            telegram.BotCommand("subscribe", "Subscribe to offers"),
            telegram.BotCommand("unsubscribe", "Unsubscribe from offers"),
        ]
    )

    updater = Updater(token=cfg_telegram_token)
    dispatcher = updater.dispatcher
    logging.info("Telegram Bot: Initialized")

    dispatcher.add_handler(CommandHandler("start", start_command))
    dispatcher.add_handler(CommandHandler("help", help_command))
    dispatcher.add_handler(CommandHandler("status", help_command))
    dispatcher.add_handler(CommandHandler("subscribe", subscribe_command))
    dispatcher.add_handler(CommandHandler("unsubscribe", unsubscribe_command))
    dispatcher.add_handler(CommandHandler("debug", debug_command))
    dispatcher.add_handler(CommandHandler("bad_command", bad_command))
    dispatcher.add_handler(MessageHandler(Filters.command, unknown))
    dispatcher.add_error_handler(error_handler)

    logging.info("Telegram Bot: Starting polling")
    updater.start_polling()  # Starts in a different thread
    sleep(1)  # For testing only
    logging.info("Telegram Bot: Stopping polling")
    updater.stop()


def error_handler(update: object, context: CallbackContext) -> None:  # type: ignore
    """Log the error and send a telegram message to notify the developer."""
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
    # TODO: You might need to add some logic to deal with messages longer than the 4096 character limit.
    update_str = update.to_dict() if isinstance(update, Update) else str(update)
    message = (
        f"An exception was raised while handling an update:\n\n"
        f"<pre>update = {html.escape(json.dumps(update_str, indent=2, ensure_ascii=False))}"
        "</pre>\n\n"
        f"<pre>context.chat_data = {html.escape(str(context.chat_data))}</pre>\n\n"
        f"<pre>context.user_data = {html.escape(str(context.user_data))}</pre>\n\n"
        f"<pre>{html.escape(tb_string)}</pre>"
    )

    # Finally, send the message
    context.bot.send_message(
        chat_id=cfg_developer_chat,
        text=message,
        parse_mode=ParseMode.HTML,
    )

    # Do some more specific error handling here:
    # - If the user blacked our bot, remove him from the database
    if isinstance(context.error, telegram.TelegramError):
        if context.error.message == "Unauthorized":
            pass
        pass


def bad_command(update: Update, context: CallbackContext) -> None:  # type: ignore
    """Raise an error to trigger the error handler."""
    context.bot.wrong_method_name()  # type: ignore[attr-defined]


def debug_command(update: Update, context: CallbackContext) -> None:  # type: ignore
    """Show some debug information."""
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


def markdown_json_formatted(input: str) -> str:
    return f"```json\n{input}\n```"


def start_command(update: Update, context: CallbackContext) -> None:  # type: ignore
    """Handle the /start command."""
    if update.message is None or update.effective_user is None:
        return
    try:
        # TODO: Register user (database) if not registered
        # - Date of registration (=now)
        # - Telegram user ID
        # - Telegram user details
        # - Telegram chat ID
        # - Number of offers received
        # - Total saved EUR
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
                R"\n\n"
                R"*Privacy*"
                "\n"
                R"The bot needs to store some user data (e.g. your Telegram user ID) to work\. "
                R"You can leave any time by typing /leave\. "
                R"This instantly deletes all data about you\."
            ),
        )
    except TelegramError as e:
        logging.error(f"Error in /start: {e}")
    pass


def leave_command(update: Update, context: CallbackContext) -> None:  # type: ignore
    """Handle the /leave command."""
    if update.message is None or update.effective_user is None:
        return
    try:
        # TODO: Delete user from database (if registered)
        update.message.reply_markdown_v2(
            (
                Rf"Hi {update.effective_user.mention_markdown_v2()}, I'm sad to see you go\. "
                R"Your user data has been deleted\. "
                R"If you want to come back at any time, just type /start to start again\!"
            ),
        )
        update.message.reply_markdown_v2(
            (
                Rf"Hi {update.effective_user.mention_markdown_v2()}, you are currently not registered\. "
                R"Your user data has been deleted\. "
                R"If you want to come back at any time, just type /start to start again\!"
            ),
        )
    except TelegramError as e:
        logging.error(f"Error in /leave: {e}")
    pass


def help_command(update: Update, context: CallbackContext) -> None:  # type: ignore
    """Handle the /help command: Display all available commands to the user."""
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
                R"/status \- Show information about your subscriptions"
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
                "\n"
                R"/leave \- Leave this bot and delete stored user data"
            )
        )
    except TelegramError as e:
        logging.error(f"Error in help_command: {e}")


def subscribe_command(update: Update, context: CallbackContext) -> None:  # type: ignore
    if not update.effective_chat or not update.message or not update.message.text:
        return
    # Check if user is registered, otherwise return
    subscription_type = update.message.text.lower().removeprefix("/subscribe").strip()

    if subscription_type == "":
        update.message.reply_markdown_v2(
            R"Sorry, this command needs a type to work\. Type /help to see all available commands\."
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
    if not update.effective_chat or not update.message or not update.message.text:
        return
    # Check if user is registered, otherwise return
    subscription_type = update.message.text.lower().removeprefix("/unsubscribe").strip()
    print(subscription_type)


def status_command(update: Update, context: CallbackContext) -> None:  # type: ignore
    if not update.effective_chat:
        return
    # Check if user is registered, then display some stats:
    # - Active subscriptions
    # - Total saved EUR
    # - Number of offers received
    if update.effective_chat:
        text_caps = " ".join(context.args).upper()  # type: ignore
        context.bot.send_message(chat_id=update.effective_chat.id, text=text_caps)


def unknown(update: Update, context: CallbackContext) -> None:  # type: ignore
    if update.effective_chat:
        context.bot.send_message(
            chat_id=update.effective_chat.id,
            text="Sorry, I didn't understand that command. Type /help to see all commands.",
        )

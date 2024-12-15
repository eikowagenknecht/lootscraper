export const BUTTON_TEXT = {
  SHOW_DETAILS: "Details",
  HIDE_DETAILS: "Summary",
  CLAIM: "Claim",
  DISMISS: "Dismiss",
  CLOSE: "Close",
} as const;

export const POPUP_TEXT = {
  SUBSCRIBED: "You are now subscribed.",
  UNSUBSCRIBED: "You are now unsubscribed.",
} as const;

export const MESSAGE_TEXT = {
  MANAGE_MENU:
    "Here you can manage your subscriptions. " +
    "To do so, just click the following buttons to subscribe / unsubscribe.",
  DISMISSED: "Dismissed (can't delete messages older than 48h).",
  MANAGE_MENU_CLOSED:
    "Thank you for managing your subscriptions. " +
    "Forgot something? " +
    "You can continue any time with /manage.",
  TIMEZONE_MENU_CLOSED:
    "Thank you for choosing your timezone. " +
    "If you live in a place with daylight saving time, please remember to do this " +
    "again at the appropriate time of year.",
  HELP:
    "*Available commands*\n" +
    "/start - Start the bot (you already did that)\n" +
    "/help - Show this help message\n" +
    "/status - Show information about your subscriptions\n" +
    "/manage - Manage your subscriptions\n" +
    "/timezone - Choose a timezone that will be used to display the start and end dates\n" +
    "/leave - Leave this bot and delete stored user data",
  UNKNOWN_COMMAND:
    "Sorry, I didn't understand that command. Type /help to see all commands.",
  CHAT_NOT_REGISTERED:
    "You are not registered. Please, register with /start command.",
  NO_SUBSCRIPTIONS: "You have no subscriptions. Change that with /manage.",
  NO_NEW_OFFERS:
    "No new offers available. I will write you as soon as they come in, I promise!",
} as const;

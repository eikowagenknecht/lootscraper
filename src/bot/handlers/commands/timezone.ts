import type { CommandContext } from "grammy";
import type { InlineKeyboardButton } from "grammy/types";
import type { TimezoneCallbackData } from "../../types/callbacks";
import type { BotContext } from "../../types/middleware";
import { CommandHandler } from "./base";

export class TimezoneCommand extends CommandHandler {
  constructor() {
    super("timezone");
  }

  async handle(ctx: CommandContext<BotContext>): Promise<void> {
    this.logCall(ctx);

    if (!(await this.userCanControlBot(ctx))) {
      return;
    }

    await ctx.reply("Choose one of the available timezones", {
      reply_markup: this.buildTimezoneKeyboard(),
    });
  }

  private buildTimezoneKeyboard() {
    const keyboard: InlineKeyboardButton[][] = [];

    // Add timezone buttons (-12 to +14)
    for (let hour = -12; hour <= 14; hour++) {
      const sign = hour >= 0 ? "+" : "";
      const data: TimezoneCallbackData = {
        action: "settimezone",
        offset: hour,
      };

      keyboard.push([
        {
          text: `UTC${sign}${hour.toFixed(0)}:00`,
          callback_data: JSON.stringify(data),
        },
      ]);
    }

    // Add close button
    keyboard.push([
      {
        text: "Close",
        callback_data: JSON.stringify({ action: "close", menu: "timezone" }),
      },
    ]);

    return { inline_keyboard: keyboard };
  }
}

import type { timezoneSchema } from "@/bot/types/callbacks";
import type { CommandContext } from "grammy";
import type { InlineKeyboardButton } from "grammy/types";
import type { z } from "zod";
import { logCall, userCanControlBot } from ".";
import type { BotContext } from "../../types/middleware";

export async function handleTimezoneCommand(
  ctx: CommandContext<BotContext>,
): Promise<void> {
  logCall(ctx);

  if (!(await userCanControlBot(ctx))) {
    return;
  }

  await ctx.reply("Choose one of the available timezones", {
    reply_markup: buildTimezoneKeyboard(),
  });
}

function buildTimezoneKeyboard() {
  const keyboard: InlineKeyboardButton[][] = [];

  // Add timezone buttons (-12 to +14)
  for (let hour = -12; hour <= 14; hour++) {
    const sign = hour >= 0 ? "+" : "";
    const data: z.infer<typeof timezoneSchema> = {
      action: "settimezone",
      offset: hour,
    };

    keyboard.push([
      {
        text: `UTC${sign}${hour.toFixed()}:00`,
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

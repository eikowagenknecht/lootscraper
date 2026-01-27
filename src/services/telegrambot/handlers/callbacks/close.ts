import type { Filter } from "grammy";

import type { BotContext } from "@/services/telegrambot/types/middleware";

import { closeSchema } from "@/services/telegrambot/types/callbacks";
import { unpackData } from "@/services/telegrambot/utils/callbackPack";
import { logger } from "@/utils/logger";

export async function handleCloseCallback(
  ctx: Filter<BotContext, "callback_query:data">,
  data: string,
): Promise<void> {
  if (!ctx.chat?.id) {
    logger.error("No chat ID in close callback");
    return;
  }

  const unpackedData = unpackData(data, closeSchema);

  let message: string;
  if (unpackedData.menu === "timezone") {
    message =
      "Thank you for choosing your timezone. " +
      "If you live in a place with daylight saving time, please remember to do this " +
      "again at the appropriate time of year.";
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(message);
    return;
  }

  // If the menu is not timezone, it must be manage
  message =
    "Thank you for managing your subscriptions. " +
    "Forgot something? " +
    "You can continue any time with /manage.";
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(message);
}

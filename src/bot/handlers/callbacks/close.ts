import { logger } from "@/utils/logger";
import type { Context, Filter } from "grammy";
import type { CloseCallbackData } from "../../types/callbacks";

export async function handleCloseCallback(
  ctx: Filter<Context, "callback_query:data">,
  data: CloseCallbackData,
): Promise<void> {
  if (!ctx.chat?.id) {
    logger.error("No chat ID in close callback");
    return;
  }

  let message: string;
  if (data.menu === "timezone") {
    message =
      "Thank you for choosing your timezone. " +
      "If you live in a place with daylight saving time, please remember to do this " +
      "again at the appropriate time of year.";
  } else {
    message =
      "Thank you for managing your subscriptions. " +
      "Forgot something? " +
      "You can continue any time with /manage.";
  }

  await ctx.editMessageText(message);
  await ctx.answerCallbackQuery();
}

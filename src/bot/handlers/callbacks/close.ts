import { unpackData } from "@/bot/utils/callbackPack";
import { logger } from "@/utils/logger";
import type { Context, Filter } from "grammy";
import { closeSchema } from "../../types/callbacks";

export async function handleCloseCallback(
  ctx: Filter<Context, "callback_query:data">,
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
  } else {
    message =
      "Thank you for managing your subscriptions. " +
      "Forgot something? " +
      "You can continue any time with /manage.";
  }

  await ctx.editMessageText(message);
  await ctx.answerCallbackQuery();
}

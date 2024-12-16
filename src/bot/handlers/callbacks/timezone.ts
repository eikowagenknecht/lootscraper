import { updateTelegramChatTimezone } from "@/services/database/telegramChatRepository";
import { logger } from "@/utils/logger";
import type { Context, Filter } from "grammy";
import type { TimezoneCallbackData } from "../../types/callbacks";

export async function handleTimezoneCallback(
  ctx: Filter<Context, "callback_query:data">,
  data: TimezoneCallbackData,
): Promise<void> {
  if (!ctx.chat?.id) {
    logger.error("No chat ID in timezone callback");
    return;
  }

  await updateTelegramChatTimezone(ctx.chat.id, data.offset);

  const message = `Timezone offset set to ${data.offset.toFixed()} hours from UTC.\n\nThank you for choosing your timezone.\nIf you live in a place with daylight saving time, please remember to do this again at the appropriate time of year.`;

  await ctx.editMessageText(message);
  await ctx.answerCallbackQuery();
}

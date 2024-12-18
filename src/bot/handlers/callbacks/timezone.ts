import { timezoneSchema } from "@/bot/types/callbacks";
import type { BotContext } from "@/bot/types/middleware";
import { unpackData } from "@/bot/utils/callbackPack";
import { updateTelegramChatTimezone } from "@/services/database/telegramChatRepository";
import { logger } from "@/utils/logger";
import type { Filter } from "grammy";

export async function handleTimezoneCallback(
  ctx: Filter<BotContext, "callback_query:data">,
  data: string,
): Promise<void> {
  if (!ctx.chat?.id) {
    logger.error("No chat ID in timezone callback");
    return;
  }

  const unpackedData = unpackData(data, timezoneSchema);

  await updateTelegramChatTimezone(ctx.chat.id, unpackedData.offset);

  const message = `Timezone offset set to ${unpackedData.offset.toFixed()} hours from UTC.\n\nThank you for choosing your timezone.\nIf you live in a place with daylight saving time, please remember to do this again at the appropriate time of year.`;

  await ctx.editMessageText(message);
  await ctx.answerCallbackQuery();
}

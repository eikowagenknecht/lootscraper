import type { BotContext } from "@/bot/types/middleware";
import { unpackData } from "@/bot/utils/callbackPack";
import {
  createTelegramSubscription,
  hasTelegramSubscription,
  removeTelegramSubscription,
} from "@/services/database/telegramSubscriptionRepository";
import { logger } from "@/utils/logger";
import type { Filter } from "grammy";
import type { z } from "zod";
import { toggleSubscriptionSchema } from "../../types/callbacks";
import { getDbChat } from "../commands";
import { buildManageKeyboard } from "../commands/manage";

export async function handleToggleCallback(
  ctx: Filter<BotContext, "callback_query:data">,
  data: string,
): Promise<void> {
  if (!ctx.chat?.id) {
    logger.error("No chat ID in toggle callback");
    return;
  }

  const unpackedData: z.infer<typeof toggleSubscriptionSchema> = unpackData(
    data,
    toggleSubscriptionSchema,
  );

  const { source, type, duration } = unpackedData;

  const dbChat = await getDbChat(ctx);

  if (!dbChat) {
    await ctx.answerCallbackQuery({
      text: "You are not registered. Please register with /start command.",
    });
    return;
  }

  const isSubscribed = await hasTelegramSubscription(
    dbChat.id,
    source,
    type,
    duration,
  );

  if (isSubscribed) {
    await removeTelegramSubscription(dbChat.id, source, type, duration);
    await ctx.answerCallbackQuery({ text: "You are now unsubscribed." });
  } else {
    await createTelegramSubscription({
      chat_id: dbChat.id,
      source: source,
      type: type,
      duration: duration,
      last_offer_id: 0,
    });
    await ctx.answerCallbackQuery({ text: "You are now subscribed." });
  }

  // Update the keyboard
  await ctx.editMessageReplyMarkup({
    reply_markup: await buildManageKeyboard(dbChat.id),
  });
}

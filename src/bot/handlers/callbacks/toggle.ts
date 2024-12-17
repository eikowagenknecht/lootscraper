import type { Context, Filter } from "grammy";
import {
  type ToggleSubscriptionCallbackData,
  toggleSubscriptionSchema,
} from "../../types/callbacks";

import { unpackData } from "@/bot/utils/callbackPack";
import {
  createTelegramSubscription,
  hasTelegramSubscription,
  removeTelegramSubscription,
} from "@/services/database/telegramSubscriptionRepository";
import { logger } from "@/utils/logger";
import { buildManageKeyboard } from "../commands/manage";

export async function handleToggleCallback(
  ctx: Filter<Context, "callback_query:data">,
  data: string,
): Promise<void> {
  if (!ctx.chat?.id) {
    logger.error("No chat ID in toggle callback");
    return;
  }

  const unpackedData: ToggleSubscriptionCallbackData = unpackData(
    data,
    toggleSubscriptionSchema,
  );

  const { source, type, duration } = unpackedData;
  const isSubscribed = await hasTelegramSubscription(
    ctx.chat.id,
    source,
    type,
    duration,
  );

  if (isSubscribed) {
    await removeTelegramSubscription(ctx.chat.id, source, type, duration);
    await ctx.answerCallbackQuery({ text: "You are now unsubscribed." });
  } else {
    await createTelegramSubscription({
      chat_id: ctx.chat.id,
      source: source,
      type: type,
      duration: duration,
      last_offer_id: 0,
    });
    await ctx.answerCallbackQuery({ text: "You are now subscribed." });
  }

  // Update the keyboard
  await ctx.editMessageReplyMarkup({
    reply_markup: await buildManageKeyboard(ctx.chat.id),
  });
}

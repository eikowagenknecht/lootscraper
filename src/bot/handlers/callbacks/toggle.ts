import type { Context, Filter } from "grammy";
import type { ToggleSubscriptionCallbackData } from "../../types/callbacks";

import {
  createTelegramSubscription,
  hasTelegramSubscription,
  removeTelegramSubscription,
} from "@/services/database/telegramSubscriptionRepository";
import type { OfferDuration, OfferSource, OfferType } from "@/types/config";
import { logger } from "@/utils/logger";
import { buildManageKeyboard } from "../commands/manage";

export async function handleToggleCallback(
  ctx: Filter<Context, "callback_query:data">,
  data: ToggleSubscriptionCallbackData,
): Promise<void> {
  if (!ctx.chat?.id) {
    logger.error("No chat ID in toggle callback");
    return;
  }

  const { source, type, duration } = data;
  const isSubscribed = await hasTelegramSubscription(
    ctx.chat.id,
    source as OfferSource,
    type as OfferType,
    duration as OfferDuration,
  );

  if (isSubscribed) {
    await removeTelegramSubscription(
      ctx.chat.id,
      source as OfferSource,
      type as OfferType,
      duration as OfferDuration,
    );
    await ctx.answerCallbackQuery({ text: "You are now unsubscribed." });
  } else {
    await createTelegramSubscription({
      chat_id: ctx.chat.id,
      source: source as OfferSource,
      type: type as OfferType,
      duration: duration as OfferDuration,
      last_offer_id: 0,
    });
    await ctx.answerCallbackQuery({ text: "You are now subscribed." });
  }

  // Update the keyboard
  await ctx.editMessageReplyMarkup({
    reply_markup: await buildManageKeyboard(ctx.chat.id),
  });
}

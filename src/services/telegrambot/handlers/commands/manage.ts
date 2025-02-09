import { hasTelegramSubscription } from "@/services/database/telegramSubscriptionRepository";
import {
  type FeedCombination,
  getEnabledFeedCombinations,
} from "@/services/scraper/utils";
import {
  closeSchema,
  toggleSubscriptionSchema,
} from "@/services/telegrambot/types/callbacks";
import type { BotContext } from "@/services/telegrambot/types/middleware";
import { packData } from "@/services/telegrambot/utils/callbackPack";
import { translationService } from "@/services/translation";
import { OfferDuration } from "@/types/basic";
import { logger } from "@/utils/logger";
import { type CommandContext, InlineKeyboard } from "grammy";
import type { z } from "zod";
import { getDbChat, logCall, userCanControlBot } from ".";

export async function handleManageCommand(
  ctx: CommandContext<BotContext>,
): Promise<void> {
  logCall(ctx);

  if (!(await userCanControlBot(ctx))) {
    return;
  }

  const dbChat = await getDbChat(ctx);
  if (!dbChat) {
    await ctx.reply(
      "You are not registered. Please register with /start command.",
    );
    return;
  }

  await ctx.reply(
    "Here you can manage your subscriptions. To do so, just click the following buttons to subscribe / unsubscribe.",
    {
      reply_markup: await buildManageKeyboard(dbChat.id),
    },
  );
}

export async function buildManageKeyboard(chatId: number) {
  const inlineKeyboard = new InlineKeyboard();

  logger.verbose(`Building manage keyboard for chat ${chatId.toFixed()}`);

  // Add subscription toggle buttons for each source/type/duration/platform combination
  const combinations = getEnabledFeedCombinations();

  for (const combination of combinations) {
    const { source, type, duration, platform } = combination;
    const isSubscribed = await hasTelegramSubscription(
      chatId,
      source,
      type,
      duration,
      platform,
    );
    const buttonText = getButtonText(combination, isSubscribed);

    const callbackData: z.infer<typeof toggleSubscriptionSchema> = {
      action: "toggle",
      source,
      type,
      duration,
      platform,
    };

    const packedData = packData(callbackData, toggleSubscriptionSchema);

    inlineKeyboard.row().text(buttonText, packedData);
  }

  inlineKeyboard
    .row()
    .text("Close", packData({ action: "close", menu: "manage" }, closeSchema));

  return inlineKeyboard;
}

function getButtonText(
  combination: FeedCombination,
  isSubscribed: boolean,
): string {
  const prefix = isSubscribed ? "[x] " : "";
  const suffix =
    combination.duration !== OfferDuration.CLAIMABLE
      ? ` (${translationService.getDurationDisplay(combination.duration)})`
      : "";
  return `${prefix}${combination.source} ${combination.type} ${combination.platform} ${suffix}`;
}

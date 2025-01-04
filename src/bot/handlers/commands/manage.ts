import { closeSchema, toggleSubscriptionSchema } from "@/bot/types/callbacks";
import type { BotContext } from "@/bot/types/middleware";
import { packData } from "@/bot/utils/callbackPack";
import { getEnabledScraperCombinations } from "@/scrapers";
import type { ScraperCombination } from "@/scrapers/utils";
import { hasTelegramSubscription } from "@/services/database/telegramSubscriptionRepository";
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

  // Add subscription toggle buttons for each source/type/duration combination
  const combinations = getEnabledScraperCombinations();

  for (const combination of combinations) {
    const { source, type, duration } = combination;
    const isSubscribed = await hasTelegramSubscription(
      chatId,
      source,
      type,
      duration,
    );
    const buttonText = getButtonText(combination, isSubscribed);

    const callbackData: z.infer<typeof toggleSubscriptionSchema> = {
      action: "toggle",
      source,
      type,
      duration,
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
  combination: ScraperCombination,
  isSubscribed: boolean,
): string {
  const prefix = isSubscribed ? "[x] " : "";
  const suffix =
    combination.duration !== OfferDuration.CLAIMABLE
      ? ` (${translationService.getDurationDisplay(combination.duration)})`
      : "";
  return `${prefix}${combination.source} ${combination.type}${suffix}`;
}

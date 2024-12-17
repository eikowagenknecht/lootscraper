import { packData } from "@/bot/utils/callbackPack";
import { hasTelegramSubscription } from "@/services/database/telegramSubscriptionRepository";
import { OfferDuration, OfferSource, OfferType } from "@/types/config";
import { type CommandContext, InlineKeyboard } from "grammy";
import { getDbChat, logCall, userCanControlBot } from ".";
import {
  type ToggleSubscriptionCallbackData,
  toggleSubscriptionSchema,
} from "../../types/callbacks";
import type { BotContext } from "../../types/middleware";

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

  // Add subscription toggle buttons for each source/type/duration combination
  const combinations = getSourceTypeDurationCombinations();

  for (const { source, type, duration } of combinations) {
    const isSubscribed = await hasTelegramSubscription(
      chatId,
      source,
      type,
      duration,
    );
    const buttonText = getButtonText(source, type, duration, isSubscribed);

    const callbackData: ToggleSubscriptionCallbackData = {
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
    .text("Close", JSON.stringify({ action: "close", menu: "manage" }));

  return inlineKeyboard;
}

function getSourceTypeDurationCombinations() {
  // TODO: Find a way to get these from the scrapers
  // For now, return default combinations
  return [
    {
      source: OfferSource.STEAM,
      type: OfferType.GAME,
      duration: OfferDuration.CLAIMABLE,
    },
    {
      source: OfferSource.EPIC,
      type: OfferType.GAME,
      duration: OfferDuration.CLAIMABLE,
    },
    {
      source: OfferSource.GOG,
      type: OfferType.GAME,
      duration: OfferDuration.CLAIMABLE,
    },
    // Add more combinations as needed
  ];
}

function getButtonText(
  source: OfferSource,
  type: OfferType,
  duration: OfferDuration,
  isSubscribed: boolean,
): string {
  const prefix = isSubscribed ? "[x] " : "";
  const suffix = duration !== OfferDuration.CLAIMABLE ? ` (${duration})` : "";
  return `${prefix}${source} ${type}${suffix}`;
}

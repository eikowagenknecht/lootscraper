import { hasTelegramSubscription } from "@/services/database/telegramSubscriptionRepository";
import { OfferDuration, OfferSource, OfferType } from "@/types/config";
import type { CommandContext } from "grammy";
import type { InlineKeyboardButton } from "grammy/types";
import type { ToggleSubscriptionCallbackData } from "../../types/callbacks";
import type { BotContext } from "../../types/middleware";
import { CommandHandler } from "./base";

export class ManageCommand extends CommandHandler {
  constructor() {
    super("manage");
  }

  async handle(ctx: CommandContext<BotContext>): Promise<void> {
    this.logCall(ctx);

    if (!(await this.userCanControlBot(ctx))) {
      return;
    }

    const dbChat = await this.getDbChat(ctx);
    if (!dbChat) {
      await ctx.reply(
        "You are not registered. Please register with /start command.",
      );
      return;
    }

    await ctx.reply(
      "Here you can manage your subscriptions. To do so, just click the following buttons to subscribe / unsubscribe.",
      {
        reply_markup: await this.buildManageKeyboard(dbChat.id),
      },
    );
  }

  async buildManageKeyboard(chatId: number) {
    const keyboard: InlineKeyboardButton[][] = [];

    // Add subscription toggle buttons for each source/type/duration combination
    const combinations = this.getSourceTypeDurationCombinations();

    for (const { source, type, duration } of combinations) {
      const isSubscribed = await hasTelegramSubscription(
        chatId,
        source,
        type,
        duration,
      );
      const buttonText = this.getButtonText(
        source,
        type,
        duration,
        isSubscribed,
      );

      const callbackData: ToggleSubscriptionCallbackData = {
        action: "toggle",
        source,
        type,
        duration,
      };

      keyboard.push([
        {
          text: buttonText,
          callback_data: JSON.stringify(callbackData),
        },
      ]);
    }

    // Add close button
    keyboard.push([
      {
        text: "Close",
        callback_data: JSON.stringify({ action: "close", menu: "manage" }),
      },
    ]);

    return { inline_keyboard: keyboard };
  }

  private getSourceTypeDurationCombinations() {
    // TODO: Once we have the scrapers implemented, get this from the scrapers
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

  private getButtonText(
    source: OfferSource,
    type: OfferType,
    duration: OfferDuration,
    isSubscribed: boolean,
  ): string {
    const prefix = isSubscribed ? "[x] " : "";
    const suffix = duration !== OfferDuration.CLAIMABLE ? ` (${duration})` : "";
    return `${prefix}${source} ${type}${suffix}`;
  }
}

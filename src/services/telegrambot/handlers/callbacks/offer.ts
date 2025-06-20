import type { Filter } from "grammy";
import { getOfferById } from "@/services/database/offerRepository";
import { getTelegramChatByChatId } from "@/services/database/telegramChatRepository";
import { offerSchema } from "@/services/telegrambot/types/callbacks";
import type { BotContext } from "@/services/telegrambot/types/middleware";
import { unpackData } from "@/services/telegrambot/utils/callbackPack";
import { formatOfferMessage } from "@/services/telegrambot/utils/formatters";
import { createOfferKeyboard } from "@/services/telegrambot/utils/keyboards";
import { logger } from "@/utils/logger";

export async function handleOfferDetailsCallback(
  ctx: Filter<BotContext, "callback_query:data">,
  data: string,
): Promise<void> {
  if (!ctx.chat?.id) {
    logger.error("No chat ID in offer details callback");
    return;
  }

  const unpackedData = unpackData(data, offerSchema);

  const dbChat = await getTelegramChatByChatId(ctx.chat.id);
  if (!dbChat) {
    await ctx.answerCallbackQuery({
      text: "Error: Chat not registered",
      show_alert: true,
    });
    return;
  }

  const offer = await getOfferById(unpackedData.offerId);
  if (!offer) {
    await ctx.answerCallbackQuery({
      text: "Error: Offer not found",
      show_alert: true,
    });
    return;
  }

  if (unpackedData.command === "show") {
    await ctx.editMessageText(
      await formatOfferMessage(offer, {
        tzOffset: dbChat.timezone_offset,
        includeDetails: true,
      }),
      {
        parse_mode: "MarkdownV2",
        reply_markup: createOfferKeyboard(offer, {
          detailsShowButton: false,
          detailsHideButton: true,
          dismissButton: true,
        }),
      },
    );
  } else {
    await ctx.editMessageText(
      await formatOfferMessage(offer, {
        tzOffset: dbChat.timezone_offset,
        includeDetails: false,
      }),
      {
        parse_mode: "MarkdownV2",
        reply_markup: createOfferKeyboard(offer, {
          detailsShowButton: offer.game_id !== null,
          detailsHideButton: false,
          dismissButton: true,
        }),
      },
    );
  }

  await ctx.answerCallbackQuery();
}

export async function handleDismissCallback(
  ctx: Filter<BotContext, "callback_query:data">,
): Promise<void> {
  try {
    // Try to delete the message first
    await ctx.deleteMessage();
    await ctx.answerCallbackQuery();
  } catch {
    // Message probably too old to delete (>48h)
    try {
      await ctx.editMessageText("Dismissed (can't delete old messages).");
      await ctx.answerCallbackQuery();
    } catch {
      // Message probably already edited (double click)
      await ctx.answerCallbackQuery();
    }
  }
}

import { unpackData } from "@/bot/utils/callbackPack";
import { getOffer } from "@/services/database/offerRepository";
import { getTelegramChatById } from "@/services/database/telegramChatRepository";
import { logger } from "@/utils/logger";
import type { Context, Filter } from "grammy";
import { offerSchema } from "../../types/callbacks";
import { formatOfferMessage } from "../../utils/formatters";
import { createOfferKeyboard } from "../../utils/keyboards";

export async function handleOfferDetailsCallback(
  ctx: Filter<Context, "callback_query:data">,
  data: string,
): Promise<void> {
  if (!ctx.chat?.id) {
    logger.error("No chat ID in offer details callback");
    return;
  }

  const unpackedData = unpackData(data, offerSchema);

  const dbChat = await getTelegramChatById(ctx.chat.id);
  if (!dbChat) {
    await ctx.answerCallbackQuery({
      text: "Error: Chat not registered",
      show_alert: true,
    });
    return;
  }

  const offer = await getOffer(unpackedData.offerId);
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
          detailsShowButton: true,
          detailsHideButton: false,
          dismissButton: true,
        }),
      },
    );
  }

  await ctx.answerCallbackQuery();
}

export async function handleDismissCallback(
  ctx: Filter<Context, "callback_query:data">,
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

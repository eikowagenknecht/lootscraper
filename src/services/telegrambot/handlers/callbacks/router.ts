import { telegramBotService } from "@/services/telegrambot";
import type { BotContext } from "@/services/telegrambot/types/middleware";
import { unpackFirstField } from "@/services/telegrambot/utils/callbackPack";
import { logger } from "@/utils/logger";
import type { Filter } from "grammy";
import { handleCloseCallback } from "./close";
import { handleDismissCallback, handleOfferDetailsCallback } from "./offer";
import { handleTimezoneCallback } from "./timezone";
import { handleToggleCallback } from "./toggle";

export async function handleCallback(
  ctx: Filter<BotContext, "callback_query:data">,
): Promise<void> {
  if (!ctx.callbackQuery.data) {
    logger.error("No callback data");
    return;
  }

  let action: string;

  const data = ctx.callbackQuery.data;

  try {
    action = unpackFirstField(ctx.callbackQuery.data);
  } catch (error) {
    logger.error(
      `Invalid callback data: ${error instanceof Error ? error.message : String(error)}`,
    );
    return;
  }

  try {
    switch (action) {
      case "toggle":
        await handleToggleCallback(ctx, data);
        break;
      case "settimezone":
        await handleTimezoneCallback(ctx, data);
        break;
      case "close":
        await handleCloseCallback(ctx, data);
        break;
      case "details":
        await handleOfferDetailsCallback(ctx, data);
        break;
      case "dismiss":
        await handleDismissCallback(ctx);
        break;
      default:
        logger.error(`Unknown callback action: ${action}`);
        await ctx.answerCallbackQuery({
          text: "Unknown callback action. This might happen when the bot was updated.",
          show_alert: true,
        });
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("message is not modified")
    ) {
      // Ignore this error, it happens when the message doesn't need to be updated
      return;
    }
    logger.warn(
      `Error handling callback: ${error instanceof Error ? error.message : String(error)}`,
    );
    try {
      if (!ctx.chatId) {
        return;
      }

      await telegramBotService.sendWithTimeout(
        ctx.chatId,
        "Couldn't handle the button press in time. This happens when too many users are using the bot at the same time and thus it gets rate-limited by Telegram. Please try again later.",
      );
    } catch (error) {
      logger.error(
        `Failed to notify user of callback error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

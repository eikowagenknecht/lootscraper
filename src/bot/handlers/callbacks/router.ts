import type { BotContext } from "@/bot/types/middleware";
import { unpackFirstField } from "@/bot/utils/callbackPack";
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
        logger.error(`Unknown callback action: ${action}}`);
        await ctx.answerCallbackQuery({
          text: "Unknown callback action",
          show_alert: true,
        });
    }
  } catch (error) {
    logger.error(
      `Error handling callback: ${error instanceof Error ? error.message : String(error)}`,
    );
    await ctx.answerCallbackQuery({
      text: "An error occurred",
      show_alert: true,
    });
  }
}

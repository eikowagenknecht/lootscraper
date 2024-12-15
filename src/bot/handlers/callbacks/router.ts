import { logger } from "@/utils/logger";
import type { Context, Filter } from "grammy";
import type { CallbackData } from "../../types/callbacks";
import { handleCloseCallback } from "./close";
import { handleDismissCallback, handleOfferDetailsCallback } from "./offer";
import { handleTimezoneCallback } from "./timezone";
import { handleToggleCallback } from "./toggle";

export async function handleCallback(
  ctx: Filter<Context, "callback_query:data">,
): Promise<void> {
  if (!ctx.callbackQuery.data) {
    logger.error("No callback data");
    return;
  }

  let data: CallbackData;
  try {
    data = JSON.parse(ctx.callbackQuery.data) as CallbackData;
  } catch (error) {
    logger.error(
      `Invalid callback data: ${error instanceof Error ? error.message : String(error)}`,
    );
    return;
  }

  try {
    switch (data.action) {
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
        logger.error(
          `Unknown callback action: ${(data as { action: string }).action}`,
        );
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

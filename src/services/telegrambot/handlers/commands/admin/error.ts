import { config } from "@/services/config";
import type { BotContext } from "@/services/telegrambot/types/middleware";
import type { CommandContext } from "grammy";
import { logCall } from "..";

export async function handleErrorCommand(
  ctx: CommandContext<BotContext>,
): Promise<void> {
  logCall(ctx);

  if (!ctx.from || ctx.from.id !== config.get().telegram.botOwnerUserId) {
    await ctx.reply("You are not an admin, so you can't use this command.");
    return;
  }

  throw new Error("This is a test error triggered by the /error command.");
}

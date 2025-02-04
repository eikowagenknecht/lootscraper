import type { BotContext } from "@/bot/types/middleware";
import { config } from "@/services/config";
import { queueAllScrapes } from "@/services/orchestrator";
import type { CommandContext } from "grammy";
import { logCall } from "..";

export async function handleScrapeNowCommand(
  ctx: CommandContext<BotContext>,
): Promise<void> {
  logCall(ctx);

  if (!ctx.from || ctx.from.id !== config.get().telegram.botOwnerUserId) {
    await ctx.reply("You are not an admin, so you can't use this command.");
    return;
  }

  queueAllScrapes();

  await ctx.reply(
    "All enabled scrapers have been queued for immediate scraping.",
  );
}

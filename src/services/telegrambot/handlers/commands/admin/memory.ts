import type { CommandContext } from "grammy";
import { config } from "@/services/config";
import { memoryMonitorService } from "@/services/memoryMonitor";
import type { BotContext } from "@/services/telegrambot/types/middleware";
import { escapeCode } from "@/services/telegrambot/utils/markdown";
import { logCall } from "..";

export async function handleMemoryCommand(
  ctx: CommandContext<BotContext>,
): Promise<void> {
  logCall(ctx);

  if (!ctx.from || ctx.from.id !== config.get().telegram.botOwnerUserId) {
    await ctx.reply("You are not an admin, so you can't use this command.");
    return;
  }

  // Get formatted memory metrics
  const metrics = memoryMonitorService.getFormattedMetrics();

  await ctx.reply(`\`\`\`\n${escapeCode(metrics)}\n\`\`\``, {
    parse_mode: "MarkdownV2",
  });
}

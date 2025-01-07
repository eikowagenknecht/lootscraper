import type { BotContext } from "@/bot/types/middleware";
import { formatJsonForMarkdown } from "@/bot/utils/markdown";
import { config } from "@/services/config";
import type { CommandContext } from "grammy";
import { logCall } from "..";

export async function handleDebugCommand(
  ctx: CommandContext<BotContext>,
): Promise<void> {
  logCall(ctx);

  if (!ctx.from || ctx.from.id !== config.get().telegram.botOwnerUserId) {
    await ctx.reply("You are not an admin, so you can't use this command.");
    return;
  }

  // Send chat info
  await ctx.reply(
    formatJsonForMarkdown({
      chat: ctx.chat,
      user: ctx.from,
    }),
    { parse_mode: "MarkdownV2" },
  );
}

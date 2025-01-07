import type { BotContext } from "@/bot/types/middleware";
import { bold, escapeText } from "@/bot/utils/markdown";
import type { CommandContext } from "grammy";
import { logCall, userCanControlBot } from ".";
export async function handleHelpCommand(
  ctx: CommandContext<BotContext>,
): Promise<void> {
  logCall(ctx);

  if (!(await userCanControlBot(ctx))) {
    return;
  }

  const helpText = `\
${bold("Available commands")}
${escapeText(`\
/start - Start the bot (you already did that)
/help - Show this help message
/status - Show information about your subscriptions
/manage - Manage your subscriptions
/timezone - Choose a timezone that will be used to display the start and end dates
/leave - Leave this bot and delete stored user data`)}`;

  await ctx.reply(helpText, { parse_mode: "MarkdownV2" });
}

import { bold, escapeText } from "@/bot/utils/markdown";
import type { CommandContext } from "grammy";
import type { BotContext } from "../../types/middleware";
import { CommandHandler } from "./base";

export class HelpCommand extends CommandHandler {
  constructor() {
    super("help");
  }

  async handle(ctx: CommandContext<BotContext>): Promise<void> {
    this.logCall(ctx);

    if (!(await this.userCanControlBot(ctx))) {
      return;
    }

    const helpText = `${bold("Available commands")}\n${escapeText(`\
/start - Start the bot (you already did that)
/help - Show this help message
/status - Show information about your subscriptions
/manage - Manage your subscriptions
/timezone - Choose a timezone that will be used to display the start and end dates
/leave - Leave this bot and delete stored user data`)}`;

    await ctx.reply(helpText, { parse_mode: "MarkdownV2" });
  }
}

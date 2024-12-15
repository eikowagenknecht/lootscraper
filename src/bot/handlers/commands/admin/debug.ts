import type { CommandContext } from "grammy";
import type { BotContext } from "../../../types/middleware";
import { formatJsonForMarkdown } from "../../../utils/markdown";
import { CommandHandler } from "../base";

export class DebugCommand extends CommandHandler {
  constructor(private readonly adminUserId: number) {
    super("debug");
  }

  async handle(ctx: CommandContext<BotContext>): Promise<void> {
    this.logCall(ctx);

    if (!ctx.from || ctx.from.id !== this.adminUserId) {
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
}

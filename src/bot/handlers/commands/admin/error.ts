import type { CommandContext } from "grammy";
import type { BotContext } from "../../../types/middleware";
import { CommandHandler } from "../base";

export class ErrorCommand extends CommandHandler {
  constructor(private readonly adminUserId: number) {
    super("error");
  }

  async handle(ctx: CommandContext<BotContext>): Promise<void> {
    this.logCall(ctx);

    if (!ctx.from || ctx.from.id !== this.adminUserId) {
      await ctx.reply("You are not an admin, so you can't use this command.");
      return;
    }

    throw new Error("This is a test error triggered by the /error command.");
  }
}

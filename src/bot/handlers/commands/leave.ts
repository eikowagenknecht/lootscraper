import { deleteTelegramChat } from "@/services/database/telegramSubscriptionRepository";
import type { CommandContext } from "grammy";
import type { BotContext } from "../../types/middleware";
import { CommandHandler } from "./base";

export class LeaveCommand extends CommandHandler {
  constructor() {
    super("leave");
  }

  async handle(ctx: CommandContext<BotContext>): Promise<void> {
    this.logCall(ctx);

    if (!(await this.userCanControlBot(ctx))) {
      return;
    }

    const dbChat = await this.getDbChat(ctx);
    if (!dbChat) {
      const message = `Hi ${this.getCallerName(ctx)}, you are currently not registered\\. So you can't leave ;\\-\\)`;

      await ctx.reply(message, { parse_mode: "MarkdownV2" });
      return;
    }

    // Delete chat and all related data (subscriptions will be deleted by foreign key cascade)
    await deleteTelegramChat(dbChat.id);

    const message = `Bye ${this.getCallerName(ctx)}, I'm sad to see you go\\. The data stored for this chat has been deleted\\. If you want to come back at any time, just type /start\\!`;

    await ctx.reply(message, { parse_mode: "MarkdownV2" });
  }
}

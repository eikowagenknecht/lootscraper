import { escapeMarkdown } from "@/bot/utils/markdown";
import { getTelegramSubscriptions } from "@/services/database/telegramSubscriptionRepository";
// src/bot/handlers/commands/status.ts
import type { CommandContext } from "grammy";
import { DateTime } from "luxon";
import { DATE_FORMATS } from "../../types/formatters";
import type { BotContext } from "../../types/middleware";
import { CommandHandler } from "./base";

export class StatusCommand extends CommandHandler {
  constructor() {
    super("status");
  }

  async handle(ctx: CommandContext<BotContext>): Promise<void> {
    this.logCall(ctx);

    if (!(await this.userCanControlBot(ctx))) {
      return;
    }

    const dbChat = await this.getDbChat(ctx);
    if (!dbChat) {
      const message = `Hi ${this.getCallerName(ctx)}, you are currently not registered\\. So there is no data stored about you\\. But I'd be happy to see you register any time with the /start command\\!`;

      await ctx.reply(message, { parse_mode: "MarkdownV2" });
      return;
    }

    // Fetch subscriptions
    const subscriptions = await getTelegramSubscriptions(dbChat.id);

    // Build subscriptions text
    let subscriptionsText: string;
    if (subscriptions.length > 0) {
      subscriptionsText = `\\- You have ${subscriptions.length.toFixed(0)} subscriptions\\. Here are the categories you are subscribed to:\\n`;

      for (const subscription of subscriptions) {
        subscriptionsText += escapeMarkdown(
          `  * ${subscription.source} / ${subscription.type} / ` +
            `${subscription.duration}\n`,
        );
      }
      subscriptionsText +=
        "You can unsubscribe from them any time with /manage\\.";
    } else {
      subscriptionsText =
        "\\- You are currently not subscribed to any categories\\. " +
        "You can change that with the /manage command if you wish\\.";
    }

    // Build timezone text
    const timezoneText = dbChat.timezone_offset
      ? `\\- Your timezone is set to ${escapeMarkdown(dbChat.timezone_offset.toString())} hours\\. You can change that with the /timezone command if you wish\\.`
      : "\\- Your timezone is not set, so UTC is used\\. " +
        "You can change that with the /timezone command if you wish\\.";

    const registrationDate = DateTime.fromISO(
      dbChat.registration_date,
    ).toFormat(DATE_FORMATS.READABLE_WITH_HOUR);

    const message = `Hi ${this.getCallerName(ctx)}, you are currently registered\\. But I'm not storing much user data, so this is all I know about you: \n\n\\- You registered on ${escapeMarkdown(registrationDate)} with the /start command\\.\n\\- Your Telegram chat id is ${escapeMarkdown(dbChat.chat_id.toString())}\\. Neat, huh? I use it to send you notifications\\.\n${subscriptionsText}\n\\- You received ${escapeMarkdown(dbChat.offers_received_count.toString())} offers so far\\.\n${timezoneText}`;

    await ctx.reply(message, { parse_mode: "MarkdownV2" });
  }
}

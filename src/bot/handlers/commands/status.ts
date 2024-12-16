import { escapeText } from "@/bot/utils/markdown";
import { getTelegramSubscriptions } from "@/services/database/telegramSubscriptionRepository";
import { toCapitalCaseAll } from "@/utils/stringTools";
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
      const messageMd = escapeText(`\
Hi ${this.getCallerName(ctx)}, you are currently not registered. \
So there is no data stored about you. \
But I'd be happy to see you register any time with the /start command!`);

      await ctx.reply(messageMd, { parse_mode: "MarkdownV2" });
      return;
    }

    // Fetch subscriptions
    const subscriptions = await getTelegramSubscriptions(dbChat.id);

    // Build subscriptions text
    let subscriptionsTextMd: string;
    if (subscriptions.length > 0) {
      subscriptionsTextMd =
        escapeText(`- You have ${subscriptions.length.toFixed()} subscriptions. Here are the categories you are subscribed to:
`);

      for (const subscription of subscriptions) {
        subscriptionsTextMd += escapeText(
          `  - ${toCapitalCaseAll(subscription.source)} / ${toCapitalCaseAll(subscription.type)} / ${toCapitalCaseAll(subscription.duration)}
`,
        );
      }
      subscriptionsTextMd += escapeText(
        "You can unsubscribe from them any time with /manage.\n",
      );
    } else {
      subscriptionsTextMd = escapeText(
        "- You are currently not subscribed to any categories. You can change that with the /manage command if you wish.\n",
      );
    }

    // Build timezone text
    const timezoneText = dbChat.timezone_offset
      ? escapeText(
          `- Your timezone is set to ${dbChat.timezone_offset.toString()} hours. \
You can change that with the /timezone command if you wish.`,
        )
      : escapeText(
          "- Your timezone is not set, so UTC is used. You can change that with the /timezone command if you wish.",
        );

    const registrationDate = DateTime.fromISO(
      dbChat.registration_date,
    ).toFormat(DATE_FORMATS.READABLE_WITH_HOUR);

    const message =
      escapeText(
        `Hi ${this.getCallerName(ctx)}, you are currently registered. \
But I'm not storing much user data, so this is all I know about you:

`,
      ) +
      escapeText(`- You registered on ${registrationDate} with the /start command.
`) +
      escapeText(
        `- Your Telegram chat id is ${dbChat.chat_id.toString()}. Neat, huh? I use it to send you notifications.
`,
      ) +
      subscriptionsTextMd +
      escapeText(
        `- You received ${dbChat.offers_received_count.toString()} offers so far.
`,
      ) +
      timezoneText;
    await ctx.reply(message, { parse_mode: "MarkdownV2" });
  }
}

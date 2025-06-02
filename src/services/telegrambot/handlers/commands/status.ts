import { getTelegramSubscriptions } from "@/services/database/telegramSubscriptionRepository";
import type { BotContext } from "@/services/telegrambot/types/middleware";
import { DATE_FORMATS } from "@/services/telegrambot/utils/formatters";
import { escapeText } from "@/services/telegrambot/utils/markdown";
import { translationService } from "@/services/translation";
import type { CommandContext } from "grammy";
import { DateTime } from "luxon";
import { getCallerName, getDbChat, logCall, userCanControlBot } from ".";

export async function handleStatusCommand(
  ctx: CommandContext<BotContext>,
): Promise<void> {
  logCall(ctx);

  if (!(await userCanControlBot(ctx))) {
    return;
  }

  const dbChat = await getDbChat(ctx);
  if (!dbChat) {
    const messageMd = escapeText(`\
Hi ${getCallerName(ctx)}, you are currently not registered. \
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
        `  - ${translationService.getSourceDisplay(subscription.source)} / ${translationService.getTypeDisplay(subscription.type)} / ${translationService.getDurationDisplay(subscription.duration)}
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
        `- Your timezone is set to UTC${dbChat.timezone_offset >= 0 ? "+" : ""}${dbChat.timezone_offset.toFixed()}:00. You can change that with the /timezone command if you wish.\n`,
      )
    : escapeText(
        "- Your timezone is not set, so UTC is used. You can change that with the /timezone command if you wish.\n",
      );

  const registrationDate = DateTime.fromISO(dbChat.registration_date).toFormat(
    DATE_FORMATS.READABLE_WITH_HOUR_TZ,
  );

  const message =
    escapeText(
      `Hi ${getCallerName(ctx)}, you are currently registered. But I'm not storing much user data, so this is all I know about you:\n\n`,
    ) +
    escapeText(`- You registered on ${registrationDate}.\n`) +
    escapeText(`- Your Telegram chat id is ${dbChat.chat_id.toString()}.\n`) +
    escapeText(
      `- You received ${dbChat.offers_received_count.toString()} offers so far.\n`,
    ) +
    timezoneText +
    subscriptionsTextMd;
  await ctx.reply(message, { parse_mode: "MarkdownV2" });
}

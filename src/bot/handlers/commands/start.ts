import { bold, escapeText, link } from "@/bot/utils/markdown";
import { createTelegramChat } from "@/services/database/telegramChatRepository";
import { createTelegramSubscription } from "@/services/database/telegramSubscriptionRepository";
import { ChatType } from "@/types";
import { OfferDuration, OfferType } from "@/types/basic";
import { OfferSource } from "@/types/basic";
import type { CommandContext } from "grammy";
import { DateTime } from "luxon";
import { getCallerName, getDbChat, logCall, userCanControlBot } from ".";
import type { BotContext } from "../../types/middleware";

export async function handleStartCommand(
  ctx: CommandContext<BotContext>,
): Promise<void> {
  logCall(ctx);

  if (!(await userCanControlBot(ctx))) {
    return;
  }

  const welcomeTextMd = `\
${escapeText("I am part of the ")}\
${link("https://github.com/eikowagenknecht/lootscraper", "LootScraper")}\
${escapeText(` project. \
If you have any problems or feature request, please use the `)}\
${link("https://github.com/eikowagenknecht/lootscraper/issues", "GitHub issues")}\
${escapeText(` to report them. \
And if you like it, please consider `)}\
${link("https://github.com/eikowagenknecht/lootscraper/stargazers", "starring it ⭐")} \
${escapeText(". Thanks a lot!")};

${bold("How it works")}
${escapeText(`For a quick start, I have just subscribed you to free offers from Steam, Epic and GOG. \
There are more sources available. To configure what kind of offers you want to see, you can use the /manage command. \
I will then send you a message every time a new offer is added. \
To see the commands you can use to talk to me, type /help.`)}

${bold("Send me offers, now!")}
${escapeText(`I haven't sent you any offers yet to give you some time to read this message. \
To see what's currently on offer, you can use the /refresh command now. \
It's not necessary to do this however, I'll send you offers automatically whenever a new one comes in.`)}

${bold("About privacy")}
${escapeText(`I need to store some user data (e.g. your Telegram chat ID and your subscriptions) in order to work. \
You can leave any time by typing /leave. \
This will immediately delete all data about you. \
Also, I will be sad to see you go.`)}`;
  const dbChat = await getDbChat(ctx);

  if (dbChat) {
    const messageMd = `\
${escapeText(`Welcome back, ${getCallerName(ctx)} 👋. \
You are already registered ❤. \
In case you forgot, this was my initial message to you:`)}

${welcomeTextMd}
`;

    await ctx.reply(messageMd, { parse_mode: "MarkdownV2" });
    return;
  }

  function getChatTypeFromContext(
    chatType: "private" | "group" | "supergroup" | "channel",
  ): ChatType {
    switch (chatType) {
      case "group":
        return ChatType.GROUP;
      case "supergroup":
        return ChatType.SUPERGROUP;
      case "channel":
        return ChatType.CHANNEL;
      default:
        return ChatType.PRIVATE;
    }
  }

  // Register new chat
  const chatId = await createTelegramChat({
    registration_date: DateTime.now().toISO(),
    chat_type: getChatTypeFromContext(ctx.chat.type),
    chat_id: ctx.chat.id,
    user_id: ctx.from?.id ?? null,
    thread_id: ctx.message?.message_thread_id ?? null,
    chat_details: JSON.stringify(ctx.chat),
    user_details: ctx.from ? JSON.stringify(ctx.from) : null,
    timezone_offset: 0,
    active: 1,
    inactive_reason: null,
    offers_received_count: 0,
    last_announcement_id: 0,
  });

  // Add default subscriptions
  for (const source of [OfferSource.STEAM, OfferSource.EPIC, OfferSource.GOG]) {
    await createTelegramSubscription({
      chat_id: chatId,
      source,
      type: OfferType.GAME,
      duration: OfferDuration.CLAIMABLE,
      last_offer_id: 0,
    });
  }

  const messageMd = `\
${escapeText(`Hi ${getCallerName(ctx)} 👋, welcome to the LootScraper Telegram Bot and thank you for registering!`)}
  
${welcomeTextMd}`;

  await ctx.reply(messageMd, { parse_mode: "MarkdownV2" });
}

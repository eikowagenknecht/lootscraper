import { bold } from "@/bot/utils/markdown";
import { createTelegramChat } from "@/services/database/telegramChatRepository";
import { createTelegramSubscription } from "@/services/database/telegramSubscriptionRepository";
import { OfferDuration, OfferSource, OfferType } from "@/types/config";
import type { CommandContext } from "grammy";
import { DateTime } from "luxon";
import type { BotContext } from "../../types/middleware";
import { CommandHandler } from "./base";

export class StartCommand extends CommandHandler {
  constructor() {
    super("start");
  }

  async handle(ctx: CommandContext<BotContext>): Promise<void> {
    this.logCall(ctx);

    if (!(await this.userCanControlBot(ctx))) {
      return;
    }

    const welcomeText = this.getWelcomeText();
    const dbChat = await this.getDbChat(ctx);

    if (dbChat) {
      const message = `Welcome back, ${this.getCallerName(ctx)} 👋\\. You are already registered ❤\\. In case you forgot, this was my initial message to you:\n\n${welcomeText}`;

      await ctx.reply(message, { parse_mode: "MarkdownV2" });
      return;
    }

    // Register new chat
    const chatId = await createTelegramChat({
      registration_date: DateTime.now().toISO(),
      chat_type: ctx.chat.type,
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
    for (const source of [
      OfferSource.STEAM,
      OfferSource.EPIC,
      OfferSource.GOG,
    ]) {
      await createTelegramSubscription({
        chat_id: chatId,
        source,
        type: OfferType.GAME,
        duration: OfferDuration.CLAIMABLE,
        last_offer_id: 0,
      });
    }

    const message =
      `Hi ${this.getCallerName(ctx)} 👋, ` +
      `welcome to the LootScraper Telegram Bot and thank you for registering\\!\n\n${welcomeText}`;

    await ctx.reply(message, { parse_mode: "MarkdownV2" });
  }

  private getWelcomeText(): string {
    return `I am part of the [LootScraper](https://github\\.com/eikowagenknecht/lootscraper) project\\. If you have any problems or feature request, please use the [GitHub issues](https://github\\.com/eikowagenknecht/lootscraper/issues) to report them\\. And if you like it, please consider [starring it ⭐](https://github\\.com/eikowagenknecht/lootscraper/stargazers)\\. Thanks a lot\\!\n\n${bold("How it works")}\nFor a quick start, I have just subscribed you to free offers from Steam, Epic and GOG\\. There are more sources available\\. To configure what kind of offers you want to see, you can use the /manage command\\. I will then send you a message every time a new offer is added\\. To see the commands you can use to talk to me, type /help\\.\n\n${bold("Send me offers, now\\!")}\nI haven't sent you any offers yet to give you some time to read this message\\. To see what's currently on offer, you can use the /refresh command now\\. It's not necessary to do this however, I'll send you offers automatically whenever a new one comes in\\.\n\n${bold("About privacy")}\nI need to store some user data \\(e\\.g\\. your Telegram chat ID and your subscriptions\\) in order to work\\. You can leave any time by typing /leave\\. This will immediately delete all data about you\\. Also, I will be sad to see you go\\.`;
  }
}

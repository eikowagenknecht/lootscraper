import { formatOfferMessage } from "@/bot/utils/formatters";
import { createOfferKeyboard } from "@/bot/utils/keyboards";
import { getNewOffers } from "@/services/database/offerRepository";
import { incrementTelegramChatOffersReceived } from "@/services/database/telegramChatRepository";
import { getTelegramSubscriptions } from "@/services/database/telegramSubscriptionRepository";
import type { Offer } from "@/types/database";
import { logger } from "@/utils/logger";
import type { CommandContext } from "grammy";
import { DateTime } from "luxon";
import { getDbChat, logCall, userCanControlBot } from ".";
import type { BotContext } from "../../types/middleware";

export async function handleRefreshCommand(
  ctx: CommandContext<BotContext>,
): Promise<void> {
  logCall(ctx);

  if (!(await userCanControlBot(ctx))) {
    return;
  }
}

export async function refreshOffersForChat(ctx: BotContext): Promise<void> {
  const dbChat = await getDbChat(ctx);
  if (!dbChat) {
    await ctx.reply(
      "You are not registered. Please register with /start command.",
    );
    return;
  }

  const subscriptions = await getTelegramSubscriptions(dbChat.id);
  if (subscriptions.length === 0) {
    await ctx.reply("You have no subscriptions. Change that with /manage.");
    return;
  }

  let offersSent = 0;
  for (const subscription of subscriptions) {
    const offers = await getNewOffers(
      DateTime.now().toJSDate(),
      subscription.type,
      subscription.source,
      subscription.duration,
      subscription.last_offer_id,
    );

    if (offers.length === 0) {
      continue;
    }

    offersSent += offers.length;

    // Send each offer
    for (const offer of offers) {
      await sendOffer(ctx, offer, dbChat.timezone_offset);
      // TODO: Track the last sent offer
    }

    // Update last offer id and offer count
    await incrementTelegramChatOffersReceived(dbChat.id);
  }

  if (offersSent === 0) {
    await ctx.reply(
      "No new offers available. I will write you as soon as they come in, I promise!",
    );
  }
}

async function sendOffer(
  ctx: BotContext,
  offer: Offer,
  timezoneOffset: number | null,
): Promise<void> {
  try {
    // For channels, groups and supergroups, always show details
    // Button presses would affect all users, so we avoid them
    const isGroup =
      ctx.chat?.type === "group" ||
      ctx.chat?.type === "supergroup" ||
      ctx.chat?.type === "channel";

    const message = await formatOfferMessage(offer, {
      tzOffset: timezoneOffset,
      includeDetails: isGroup,
    });

    const keyboard = isGroup
      ? createOfferKeyboard(offer)
      : createOfferKeyboard(offer, {
          detailsShowButton: true,
          detailsHideButton: false,
          dismissButton: true,
        });

    await ctx.reply(message, {
      parse_mode: "MarkdownV2",
      reply_markup: keyboard,
    });
  } catch (error) {
    logger.error(
      `Error sending offer ${offer.id.toFixed()}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

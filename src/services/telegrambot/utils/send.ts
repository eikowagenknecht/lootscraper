import { getNewAnnouncements } from "@/services/database/announcementRepository";
import { getActiveOffers } from "@/services/database/offerRepository";
import {
  deactivateTelegramChat,
  getTelegramChatById,
  incrementTelegramChatOffersReceived,
  updateTelegramChatLastAnnouncementId,
} from "@/services/database/telegramChatRepository";
import {
  getTelegramSubscriptions,
  updateTelegramSubscription,
} from "@/services/database/telegramSubscriptionRepository";
import { telegramBotService } from "@/services/telegrambot";
import { formatOfferMessage } from "@/services/telegrambot/utils/formatters";
import { createOfferKeyboard } from "@/services/telegrambot/utils/keyboards";
import { ChatType } from "@/types";
import { logger } from "@/utils/logger";
import { GrammyError } from "grammy";
import { DateTime } from "luxon";

export async function sendNewOffersToChat(
  dbChatId: number,
  interactive = false,
): Promise<void> {
  const chat = await getTelegramChatById(dbChatId);
  if (chat === undefined) {
    logger.error(
      `Can't send offer, chat ${dbChatId.toFixed()} not found in database.`,
    );
    return;
  }

  try {
    const subscriptions = await getTelegramSubscriptions(dbChatId);

    if (interactive && !chat.thread_id && subscriptions.length === 0) {
      await telegramBotService
        .getBot()
        .api.sendMessage(
          chat.chat_id,
          "You have no subscriptions. Change that with /manage.",
        );
    }

    let offersSent = 0;
    for (const subscription of subscriptions) {
      let latestOfferId = subscription.last_offer_id;

      const offers = await getActiveOffers(DateTime.now(), {
        type: subscription.type,
        source: subscription.source,
        duration: subscription.duration,
        platform: subscription.platform,
        lastOfferId: subscription.last_offer_id,
      });

      for (const offer of offers) {
        // For channels, groups and supergroups, show no buttons as they would
        // affect all users. Always show details.
        const isMultiUserChat =
          chat.chat_type === ChatType.GROUP ||
          chat.chat_type === ChatType.SUPERGROUP ||
          chat.chat_type === ChatType.CHANNEL;

        const message = await formatOfferMessage(offer, {
          tzOffset: chat.timezone_offset,
          includeDetails: isMultiUserChat,
        });

        const keyboard = isMultiUserChat
          ? createOfferKeyboard(offer)
          : createOfferKeyboard(offer, {
              detailsShowButton: offer.game_id !== null,
              detailsHideButton: false,
              dismissButton: true,
            });

        await telegramBotService
          .getBot()
          .api.sendMessage(chat.chat_id, message, {
            parse_mode: "MarkdownV2",
            reply_markup: keyboard,
            ...(chat.thread_id && { message_thread_id: chat.thread_id }),
          });

        // After sending the offer, increment the counter and update the subscription
        // to reflect the latest sent offer.
        await incrementTelegramChatOffersReceived(dbChatId);
        latestOfferId = Math.max(latestOfferId, offer.id);
        await updateTelegramSubscription(subscription.id, {
          last_offer_id: latestOfferId,
        });
        offersSent++;
      }

      if (interactive && chat.thread_id && offersSent === 0) {
        await telegramBotService
          .getBot()
          .api.sendMessage(
            chat.chat_id,
            "No new offers found for your subscriptions.",
          );
      }
    }
  } catch (error) {
    // Check for blocked chat errors
    if (error instanceof GrammyError && isPermanentlyBlockedChat(error)) {
      logger.info(
        `Chat ${chat.chat_id.toFixed()} is no longer accessible, marking as inactive.`,
      );
      await deactivateTelegramChat(
        dbChatId,
        `${error.error_code.toFixed()}: ${error.description}`,
      );
      return;
    }

    logger.error(
      `Failed to process offers for chat ${chat.chat_id.toFixed()}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

export async function sendNewAnnouncementsToChat(
  dbChatId: number,
): Promise<void> {
  const chat = await getTelegramChatById(dbChatId);
  if (chat === undefined) {
    logger.error(
      `Can't send announcement, chat ${dbChatId.toFixed()} not found in database.`,
    );
    return;
  }

  try {
    // Get new announcements for this chat
    const announcements = await getNewAnnouncements(chat.last_announcement_id);

    // Send each announcement
    for (const announcement of announcements) {
      await telegramBotService
        .getBot()
        .api.sendMessage(chat.chat_id, announcement.text_markdown, {
          parse_mode: "MarkdownV2",
          ...(chat.thread_id && { message_thread_id: chat.thread_id }),
        });

      await updateTelegramChatLastAnnouncementId(chat.id, announcement.id);

      logger.verbose(
        `Sent announcement ${announcement.id.toFixed()} to chat ${chat.chat_id.toFixed()}`,
      );
    }
  } catch (error) {
    // Check for blocked chat errors
    if (error instanceof GrammyError && isPermanentlyBlockedChat(error)) {
      logger.info(
        `Chat ${chat.chat_id.toFixed()} is no longer accessible, marking as inactive.`,
      );
      await deactivateTelegramChat(
        dbChatId,
        `${error.error_code.toFixed()}: ${error.description}`,
      );
      return;
    }

    logger.error(
      `Failed to process announcements for chat ${chat.chat_id.toFixed()}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function isPermanentlyBlockedChat(error: Error): boolean {
  return (
    error instanceof GrammyError &&
    (error.error_code === 403 ||
      error.description.includes("chat not found") ||
      error.description.includes("bot was blocked by the user") ||
      error.description.includes("user is deactivated") ||
      error.description.includes("message thread not found") ||
      error.description.includes("bot was kicked from the group chat") ||
      error.description.includes("the group chat was deleted"))
  );
}

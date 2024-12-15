import type { BotContext } from "@/bot/types/middleware";
import { logger } from "@/utils/logger";
// src/services/announcement.ts
import type { Bot } from "grammy";
import { getNewAnnouncements } from "./database/announcementRepository";
import {
  getAllActiveTelegramChats,
  updateTelegramChatLastAnnouncementId,
} from "./database/telegramChatRepository";

export class AnnouncementService {
  constructor(private readonly bot: Bot<BotContext>) {}

  public async broadcastNewAnnouncements(): Promise<void> {
    // TODO: Make sure we're not running multiple instances of this function
    try {
      // Get all active chats
      const chats = await getAllActiveTelegramChats();
      if (chats.length === 0) {
        return;
      }

      for (const chat of chats) {
        try {
          // Get new announcements for this chat
          const announcements = await getNewAnnouncements(
            chat.last_announcement_id,
          );
          if (announcements.length === 0) {
            continue;
          }

          // Send each announcement
          for (const announcement of announcements) {
            try {
              await this.bot.api.sendMessage(
                chat.chat_id,
                announcement.text_markdown,
                {
                  parse_mode: "MarkdownV2",
                  ...(chat.thread_id && { message_thread_id: chat.thread_id }),
                },
              );

              // Update last announcement ID
              await updateTelegramChatLastAnnouncementId(
                chat.id,
                announcement.id,
              );

              logger.debug(
                `Sent announcement ${announcement.id.toFixed()} to chat ${chat.chat_id.toFixed()}`,
              );
            } catch (error) {
              logger.error(
                `Failed to send announcement ${announcement.id.toFixed()} to chat ${chat.chat_id.toFixed()}: ${error instanceof Error ? error.message : String(error)}`,
              );
            }
          }
        } catch (error) {
          logger.error(
            `Failed to process announcements for chat ${chat.chat_id.toFixed()}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    } catch (error) {
      logger.error(
        `Failed to broadcast announcements: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

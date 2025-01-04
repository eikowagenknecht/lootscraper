import { getAllActiveTelegramChats } from "@/services/database/telegramChatRepository";
import type { Config } from "@/types/config";
import { logger } from "@/utils/logger";
import type { Bot } from "grammy";
import {
  sendNewAnnouncementsToChat,
  sendNewOffersToChat,
} from "./helpers/send";
import { TelegramBot } from "./index";
import type { BotConfig } from "./types/config";
import type { BotContext } from "./types/middleware";

export class TelegramBotService {
  private static instance: TelegramBotService | null = null;
  private bot: TelegramBot | null = null;
  private checkInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Private constructor to prevent instantiation
  }

  public static getInstance(): TelegramBotService {
    if (!TelegramBotService.instance) {
      TelegramBotService.instance = new TelegramBotService();
    }
    return TelegramBotService.instance;
  }

  public async initialize(config: Config): Promise<void> {
    const botConfig: BotConfig = {
      accessToken: config.telegram.accessToken,
      developerChatId: config.telegram.developerChatId,
      adminUserId: config.telegram.adminUserId,
      logLevel: config.telegram.logLevel,
    };

    this.bot = new TelegramBot(botConfig);
    await this.bot.initialize();
  }

  public async start(): Promise<void> {
    if (!this.bot) {
      throw new Error("Bot not initialized. Call initialize() first.");
    }

    await this.bot.start();

    // Start periodic announcement check
    this.startAnnouncementCheck();
  }

  public async stop(): Promise<void> {
    // Stop periodic checks
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    if (this.bot) {
      await this.bot.stop();
    }
  }

  // TODO: Merge TelegramBotService with TelegramBot class
  public getBot(): Bot<BotContext> {
    if (!this.bot) {
      throw new Error("Bot not initialized. Call initialize() first.");
    }
    return this.bot.getBot();
  }

  private startAnnouncementCheck(): void {
    // Check for new messages to send every minute
    this.checkInterval = setInterval(() => {
      void (async () => {
        try {
          // TODO: Make sure we're not running multiple instances of this function
          await this.broadcastNewMessages();
        } catch (error) {
          logger.error(
            `Error in announcement check: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      })();
    }, 60000); // 1 minute
  }

  private async broadcastNewMessages(): Promise<void> {
    if (!this.bot) {
      throw new Error("Bot not initialized. Call initialize() first.");
    }

    try {
      const chats = await getAllActiveTelegramChats();

      for (const chat of chats) {
        await sendNewAnnouncementsToChat(chat.id);
        await sendNewOffersToChat(chat.id);
      }
    } catch (error) {
      logger.error(
        `Failed to broadcast: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const telegramBotService = TelegramBotService.getInstance();

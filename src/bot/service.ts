import { getAllActiveTelegramChats } from "@/services/database/telegramChatRepository";
import type { Config } from "@/types/config";
import { logger } from "@/utils/logger";
import type { Bot } from "grammy";
import { TelegramBot } from "./index";
import type { BotConfig } from "./types/config";
import type { BotContext } from "./types/middleware";
import { sendNewAnnouncementsToChat, sendNewOffersToChat } from "./utils/send";

export class TelegramBotService {
  private static instance: TelegramBotService | null = null;
  private bot: TelegramBot | null = null;
  private executor: NodeJS.Timeout | null = null;
  private sendingBroadcast = false;

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
      botLogChatId: config.telegram.botLogChatId,
      botOwnerUserId: config.telegram.botOwnerUserId,
      logLevel: config.telegram.logLevel,
    };

    this.bot = new TelegramBot(botConfig);
    await this.bot.initialize();
  }

  public start(): void {
    if (!this.bot) {
      throw new Error("Bot not initialized. Call initialize() first.");
    }

    // This never resolves as long as the bot is running, so we don't await it
    void this.bot.start();

    // Start periodic announcement check
    this.startBroadcastCheck();
  }

  public async stop(): Promise<void> {
    // Stop periodic checks
    if (this.executor) {
      clearInterval(this.executor);
      this.executor = null;
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

  private startBroadcastCheck(): void {
    const checkNewMessages = async () => {
      if (this.sendingBroadcast) {
        logger.verbose(
          "Telegram service is already broadcasting messages, skipping check.",
        );
        return;
      }
      this.sendingBroadcast = true;
      try {
        logger.debug("Checking for new broadcasts to send.");
        await this.broadcastNewMessages();
        this.sendingBroadcast = false;
      } catch (error) {
        logger.error(
          `Error in broadcast check: ${error instanceof Error ? error.message : String(error)}`,
        );
        this.sendingBroadcast = false;
      }
    };

    // Run immediately
    logger.verbose("Running broadcast check immediately.");
    void checkNewMessages();

    logger.verbose("Scheduling broadcast check to run every 5s.");
    this.executor = setInterval(() => void checkNewMessages(), 5000);
  }

  private async broadcastNewMessages(): Promise<void> {
    if (!this.bot?.getBot().isRunning()) {
      logger.error("Bot is not running, skipping broadcast check.");
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

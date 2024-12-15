import { AnnouncementService } from "@/services/announcement";
import type { ConfigService } from "@/services/config";
import { logger } from "@/utils/logger";
import { TelegramBot } from "./index";
import type { BotConfig } from "./types/config";

export class TelegramBotService {
  private static instance: TelegramBotService | null = null;
  private bot: TelegramBot | null = null;
  private announcementService: AnnouncementService | null = null;
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

  public async initialize(config: ConfigService): Promise<void> {
    const botConfig: BotConfig = {
      accessToken: config.get().telegram.accessToken,
      developerChatId: config.get().telegram.developerChatId,
      adminUserId: config.get().telegram.adminUserId,
      logLevel: config.get().telegram.logLevel,
    };

    this.bot = new TelegramBot(botConfig);
    await this.bot.initialize();

    // Initialize announcement service
    this.announcementService = new AnnouncementService(this.bot.getBot());
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

  private startAnnouncementCheck(): void {
    // Check for new announcements every minute
    this.checkInterval = setInterval(() => {
      void (async () => {
        try {
          if (this.announcementService) {
            await this.announcementService.broadcastNewAnnouncements();
          }
        } catch (error) {
          logger.error(
            `Error in announcement check: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      })();
    }, 60000); // 1 minute
  }
}

export const telegramBotService = TelegramBotService.getInstance();

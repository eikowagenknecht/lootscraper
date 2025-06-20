import { autoRetry } from "@grammyjs/auto-retry";
import { CommandGroup, commandNotFound, commands } from "@grammyjs/commands";
import { AbortController } from "abort-controller";
import {
  Bot,
  type BotError,
  GrammyError,
  HttpError,
  type RawApi,
} from "grammy";
import { DateTime } from "luxon";
import type { Other } from "node_modules/grammy/out/core/api";
import type { BotContext } from "@/services/telegrambot/types/middleware";
import {
  sendNewAnnouncementsToChat,
  sendNewOffersToChat,
} from "@/services/telegrambot/utils/send";
import type { Config, TelegramLogLevel } from "@/types/config";
import { handleError } from "@/utils/errorHandler";
import { logger } from "@/utils/logger";
import {
  getChatsNeedingAnnouncements,
  getChatsNeedingOffers,
} from "./database/offerRepository";
import { handleCallback } from "./telegrambot/handlers/callbacks/router";
import {
  handleHelpCommand,
  handleStartCommand,
} from "./telegrambot/handlers/commands";
import {
  handleAnnounceCommand,
  handleDebugCommand,
  handleErrorCommand,
  handleRefreshInfoCommand,
  handleScrapeNowCommand,
} from "./telegrambot/handlers/commands/admin";
import { handleLeaveCommand } from "./telegrambot/handlers/commands/leave";
import { handleManageCommand } from "./telegrambot/handlers/commands/manage";
import { handleRefreshCommand } from "./telegrambot/handlers/commands/refresh";
import { handleStatusCommand } from "./telegrambot/handlers/commands/status";
import { handleTimezoneCommand } from "./telegrambot/handlers/commands/timezone";

interface BotConfig {
  accessToken: string;
  botLogChatId: number;
  botOwnerUserId: number;
  logLevel: TelegramLogLevel;
  dropPendingUpdates: boolean;
}

export class TelegramBotService {
  private static instance: TelegramBotService | null = null;
  private bot: Bot<BotContext> | null = null;
  private botConfig: BotConfig | null = null;
  private executor: NodeJS.Timeout | null = null;
  private sendingBroadcast = false;

  private constructor() {
    // Private constructor to prevent instantiation
  }

  public static getInstance(): TelegramBotService {
    TelegramBotService.instance ??= new TelegramBotService();
    return TelegramBotService.instance;
  }

  public async initialize(config: Config): Promise<void> {
    this.botConfig = {
      accessToken: config.telegram.accessToken,
      botLogChatId: config.telegram.botLogChatId,
      botOwnerUserId: config.telegram.botOwnerUserId,
      logLevel: config.telegram.logLevel,
      dropPendingUpdates: config.telegram.dropPendingMessages,
    };

    this.bot = new Bot<BotContext>(this.botConfig.accessToken);

    try {
      // Automatically retry on rate limits
      this.bot.api.config.use(autoRetry());
      this.bot.use(commands());

      const userCommands = new CommandGroup<BotContext>();
      userCommands.command(
        "start",
        "Register and start the bot",
        handleStartCommand,
      );
      userCommands.command(
        "help",
        "Show available commands",
        handleHelpCommand,
      );
      userCommands.command(
        "manage",
        "Manage your subscriptions",
        handleManageCommand,
      );
      userCommands.command("status", "Show your status", handleStatusCommand);
      userCommands.command(
        "timezone",
        "Set your timezone",
        handleTimezoneCommand,
      );
      userCommands.command(
        "refresh",
        "Check for new offers",
        handleRefreshCommand,
      );
      userCommands.command(
        "leave",
        "Unregister and delete your data",
        handleLeaveCommand,
      );
      const adminCommands = new CommandGroup<BotContext>();
      adminCommands.command(
        "announce",
        "Send an announcement",
        handleAnnounceCommand,
      );
      adminCommands.command("debug", "Show chat IDs", handleDebugCommand);
      adminCommands.command("scrapenow", "Scrape now", handleScrapeNowCommand);
      adminCommands.command(
        "refreshinfo",
        "Refresh game info",
        handleRefreshInfoCommand,
      );
      adminCommands.command("error", "Generate an error", handleErrorCommand);

      this.bot.use(userCommands);
      this.bot.use(adminCommands);
      await userCommands.setCommands(this.bot);

      this.bot
        // Check if there is a command
        .filter(commandNotFound(userCommands))
        // If so, that means it wasn't handled by any of our commands.
        .use(async (ctx) => {
          if (ctx.message?.text) {
            logger.debug("Command not found:", ctx.message.text);
          } else {
            logger.debug("Command not found:", ctx.update);
          }
          if (ctx.commandSuggestion) {
            // We found a potential match
            await ctx.reply(
              `Hmm... I don't know that command. Did you mean ${ctx.commandSuggestion}?`,
            );
            return;
          }
          // Nothing seems to come close to what the user typed
          await ctx.reply("Oops... I don't know that command :/");
        });

      // Callback queries
      this.bot.on("callback_query:data", handleCallback);

      // Register error handler
      this.bot.catch(this.handleError.bind(this));

      // Initialize the bot
      await this.bot.init();
    } catch (error) {
      throw new Error(
        `Failed to initialize Telegram bot: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  public start(): void {
    if (!this.bot || !this.botConfig) {
      throw new Error("Bot not initialized. Call initialize() first.");
    }

    try {
      // This never resolves as long as the bot is running, so we don't await it
      void this.bot.start({
        onStart: () => {
          logger.info("Telegram bot listening to messages.");
        },
        drop_pending_updates: this.botConfig.dropPendingUpdates,
      });
    } catch (error) {
      throw new Error(
        `Failed to start Telegram bot: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

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
      try {
        await this.bot.stop();
      } catch (error) {
        logger.error(
          `Error stopping Telegram bot: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  public getBot(): Bot<BotContext> {
    if (!this.bot) {
      throw new Error("Bot not initialized. Call initialize() first.");
    }
    return this.bot;
  }

  private startBroadcastCheck(): void {
    const checkNewMessages = async () => {
      if (this.sendingBroadcast) {
        logger.verbose("Telegram service is busy broadcasting messages.");
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
    if (!this.bot?.isRunning()) {
      logger.error("Bot is not running, skipping broadcast check.");
    }

    try {
      // Get latest offer IDs for all combinations at once
      const chatsNeedingAnnouncements = await getChatsNeedingAnnouncements();
      const chatsNeedingUpdates = await getChatsNeedingOffers(DateTime.now());

      for (const chatId of chatsNeedingAnnouncements) {
        await sendNewAnnouncementsToChat(chatId);
      }

      for (const chatId of chatsNeedingUpdates) {
        await sendNewOffersToChat(chatId);
      }
    } catch (error) {
      logger.error(
        `Failed to broadcast: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private handleError(error: BotError): void {
    logger.debug(
      `Error while handling update ${error.ctx.update.update_id.toFixed()}:`,
      JSON.stringify(error.ctx, null, 2),
    );

    if (error instanceof GrammyError) {
      logger.error("Error in request:", error.description);
    } else if (error instanceof HttpError) {
      logger.error("Could not connect to Telegram:", error);
    } else {
      handleError(error);
    }
  }

  public async sendWithTimeout(
    chatId: number,
    message: string,
    options?: Other<RawApi, "sendMessage", "chat_id" | "text">,
  ): Promise<void> {
    const abortController = new AbortController();
    let timeoutId: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        abortController.abort();
        reject(new Error("Telegram API timeout"));
      }, 5000);
    });
    try {
      await Promise.race([
        telegramBotService
          .getBot()
          .api.sendMessage(chatId, message, options, abortController.signal),
        timeoutPromise,
      ]);
      // Clear timeout so the rejection doesn't silently throw after the message
      // is sent
      if (timeoutId) clearTimeout(timeoutId);
    } catch (error) {
      // Abort sending so the message doesn't get sent later
      abortController.abort();
      throw error;
    }
  }
}

export const telegramBotService = TelegramBotService.getInstance();

import { handleError } from "@/utils/errorHandler";
import { logger } from "@/utils/logger";
import { Bot, type BotError, GrammyError, HttpError } from "grammy";
import { handleCallback } from "./handlers/callbacks/router";
import {
  handleAnnounceCommand,
  handleDebugCommand,
  handleErrorCommand,
} from "./handlers/commands/admin";
import { handleHelpCommand } from "./handlers/commands/help";
import { handleLeaveCommand } from "./handlers/commands/leave";
import { handleManageCommand } from "./handlers/commands/manage";
import { handleRefreshCommand } from "./handlers/commands/refresh";
import { handleStartCommand } from "./handlers/commands/start";
import { handleStatusCommand } from "./handlers/commands/status";
import { handleTimezoneCommand } from "./handlers/commands/timezone";
import type { BotConfig } from "./types/config";
import type { BotContext } from "./types/middleware";

export class TelegramBot {
  private bot: Bot<BotContext>;
  private initialized = false;

  constructor(private readonly config: BotConfig) {
    this.bot = new Bot<BotContext>(config.accessToken);
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Register regular commands
      this.bot.command("start", handleStartCommand);
      this.bot.command("help", handleHelpCommand);
      this.bot.command("manage", handleManageCommand);
      this.bot.command("status", handleStatusCommand);
      this.bot.command("timezone", handleTimezoneCommand);
      this.bot.command("refresh", handleRefreshCommand);
      this.bot.command("leave", handleLeaveCommand);
      await this.bot.api.setMyCommands([
        { command: "start", description: "Register and start the bot" },
        { command: "help", description: "Show available commands" },
        { command: "manage", description: "Manage your subscriptions" },
        { command: "status", description: "Show your status" },
        { command: "timezone", description: "Set your timezone" },
        { command: "refresh", description: "Check for new offers" },
        { command: "leave", description: "Unregister and delete your data" },
      ]);

      // Register admin commands
      this.bot.command("announce", handleAnnounceCommand);
      this.bot.command("debug", handleDebugCommand);
      this.bot.command("error", handleErrorCommand);

      // TODO: Handle unknown commands with the "command" plugin: https://grammy.dev/plugins/commands

      // Callback queries
      this.bot.on("callback_query:data", handleCallback);

      // Register error handler
      this.bot.catch(this.handleError.bind(this));

      // Initialize the bot
      await this.bot.init();

      this.initialized = true;
      logger.info("Telegram bot initialized successfully");
    } catch (error) {
      throw new Error(
        `Failed to initialize Telegram bot: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  public async start(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Start the bot
      await this.bot.start({
        onStart: () => {
          logger.info("Telegram bot started successfully");
        },
      });
    } catch (error) {
      throw new Error(
        `Failed to start Telegram bot: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  public async stop(): Promise<void> {
    try {
      await this.bot.stop();
      logger.info("Telegram bot stopped successfully");
    } catch (error) {
      logger.error(
        `Error stopping Telegram bot: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async handleError(error: BotError): Promise<void> {
    logger.debug(
      `Error while handling update ${error.ctx.update.update_id.toFixed()}:`,
      JSON.stringify(error.ctx, null, 2),
    );

    if (error instanceof GrammyError) {
      logger.error("Error in request:", error.description);
    } else if (error instanceof HttpError) {
      logger.error("Could not connect to Telegram:", error);
    } else {
      logger.error("Unknown error:", error);
    }

    handleError(error);

    if (this.config.developerChatId) {
      try {
        const errorMessage = `\`\`\`\nError in Telegram bot: ${error.message}\n\nStack: ${error.stack ?? "No stack trace available"}\n\`\`\``;

        await this.bot.api.sendMessage(
          this.config.developerChatId,
          errorMessage,
          { parse_mode: "MarkdownV2" },
        );
      } catch (sendError) {
        logger.error(
          `Failed to send error to developer: ${sendError instanceof Error ? sendError.message : String(sendError)}`,
        );
      }
    }
  }

  public getBot(): Bot<BotContext> {
    if (!this.initialized) {
      throw new Error("Bot not initialized. Call initialize() first.");
    }
    return this.bot;
  }
}

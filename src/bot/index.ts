import { handleError } from "@/utils/errorHandler";
import { logger } from "@/utils/logger";
import { Bot, type BotError, GrammyError, HttpError } from "grammy";
import { handleCallback } from "./handlers/callbacks/router";
import {
  AnnounceCommand,
  DebugCommand,
  ErrorCommand,
} from "./handlers/commands/admin";
import { HelpCommand } from "./handlers/commands/help";
import { LeaveCommand } from "./handlers/commands/leave";
import { ManageCommand } from "./handlers/commands/manage";
import { RefreshCommand } from "./handlers/commands/refresh";
import { StartCommand } from "./handlers/commands/start";
import { StatusCommand } from "./handlers/commands/status";
import { TimezoneCommand } from "./handlers/commands/timezone";
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
      // Register command handlers
      this.registerCommands();

      // Register callback handler
      this.bot.on("callback_query:data", (ctx) => handleCallback(ctx));

      // Register error handler
      this.bot.catch(this.handleError.bind(this));

      // Initialize the bot
      await this.bot.init();

      // Set up commands in Telegram menu
      await this.bot.api.setMyCommands([
        { command: "start", description: "Register and start the bot" },
        { command: "help", description: "Show available commands" },
        { command: "manage", description: "Manage your subscriptions" },
        { command: "status", description: "Show your status" },
        { command: "timezone", description: "Set your timezone" },
        { command: "refresh", description: "Check for new offers" },
        { command: "leave", description: "Unregister and delete your data" },
      ]);

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

  private registerCommands(): void {
    const regularCommands = [
      new StartCommand(),
      new HelpCommand(),
      new ManageCommand(),
      new StatusCommand(),
      new TimezoneCommand(),
      new LeaveCommand(),
      new RefreshCommand(),
    ];

    const adminCommands = [
      new AnnounceCommand(this.config.adminUserId),
      new DebugCommand(this.config.adminUserId),
      new ErrorCommand(this.config.adminUserId),
    ];

    // Register regular commands
    for (const command of regularCommands) {
      this.bot.command(command.commandName, (ctx) => command.handle(ctx));
    }

    // Register admin commands
    for (const command of adminCommands) {
      this.bot.command(command.commandName, (ctx) => command.handle(ctx));
    }

    // TODO: Handle unknown commands with the "command" plugin: https://grammy.dev/plugins/commands
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

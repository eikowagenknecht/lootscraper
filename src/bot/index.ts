import { handleError } from "@/utils/errorHandler";
import { logger } from "@/utils/logger";
import { splitIntoChunks } from "@/utils/stringTools";
import { autoRetry } from "@grammyjs/auto-retry";
import { CommandGroup, commandNotFound, commands } from "@grammyjs/commands";
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
import { bold, escapeText } from "./utils/markdown";

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

    if (this.config.botLogChatId) {
      try {
        let errorMessage = escapeText(`⚠️ ${error.message}`);
        if (error.stack) {
          errorMessage += `

${bold("Stack:")}
\`\`\`
${escapeText(error.stack)}
\`\`\``;
        }

        // Send the error message in chunks since stack traces can be long
        const chunks = splitIntoChunks(errorMessage, 4000);

        for (const chunk of chunks) {
          await this.bot.api.sendMessage(this.config.botLogChatId, chunk, {
            parse_mode: "MarkdownV2",
          });
        }
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

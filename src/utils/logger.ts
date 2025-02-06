import { resolve } from "node:path";
import { telegramBotService } from "@/services/telegrambot";
import {
  bold,
  escapeCode,
  escapeText,
} from "@/services/telegrambot/utils/markdown";
import type { TelegramLogLevel } from "@/types";
import type { Format, TransformableInfo } from "logform";
import { DateTime } from "luxon";
import { type LogEntry, createLogger, format, transports } from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import Transport from "winston-transport";
import { getDataPath } from "./path";
import { splitIntoChunks } from "./stringTools";

interface LoggerConfig {
  console: {
    level: string;
    format?: Format;
  };
  file: {
    level: string;
    format: Format;
    filename: string;
    maxSize: string;
    maxFiles: string;
  };
}

const DEFAULT_CONFIG: LoggerConfig = {
  console: {
    level: "info",
    format: format.simple(),
  },
  file: {
    level: "info",
    format: format.combine(format.timestamp(), format.json()),
    filename: "lootscraper-%DATE%",
    maxSize: "20m",
    maxFiles: "14d",
  },
};

function getLogLevel(source: string): string {
  // Environment variable takes precedence
  const envLevel = process.env.LOG_LEVEL;
  if (envLevel) {
    return envLevel.toLowerCase();
  }

  return source.toLowerCase();
}

function createConsoleFormat() {
  return format.printf((info: TransformableInfo) => {
    const timestamp = (info.timestamp as string) || DateTime.now().toISO();
    const message = info.message as string;
    const level = info.level;
    return `${timestamp} [${level}] ${message}`;
  });
}

function createLoggerInstance() {
  console.log("Initializing logger...");
  const logger = createLogger({});

  // Always add console transport with environment-aware configuration
  logger.add(
    new transports.Console({
      level: getLogLevel(DEFAULT_CONFIG.console.level),
      format: format.combine(
        format.colorize(),
        format.timestamp(),
        createConsoleFormat(),
      ),
    }),
  );

  // Function to add file transport after config is loaded
  function addFileTransport(
    configuredLogLevel?: string,
    logFile?: string,
  ): void {
    const fileConfig = DEFAULT_CONFIG.file;

    const finalLogLevel = configuredLogLevel
      ? getLogLevel(configuredLogLevel)
      : getLogLevel(fileConfig.level);

    logger.add(
      new DailyRotateFile({
        filename: resolve(getDataPath(), "log", logFile ?? fileConfig.filename),
        datePattern: "YYYY-MM-DD",
        extension: ".log",
        zippedArchive: true,
        maxSize: fileConfig.maxSize,
        maxFiles: fileConfig.maxFiles,
        level: finalLogLevel,
        format: fileConfig.format,
      }),
    );
  }

  function updateConsoleLevel(level: string): void {
    const consoleTransport = logger.transports.find(
      (t) => t instanceof transports.Console,
    );

    if (consoleTransport) {
      consoleTransport.level = getLogLevel(level);
    }
  }

  function addTelegramTransport(level: TelegramLogLevel, chatId: number): void {
    // Only add if Telegram logging is enabled and we have a chat ID
    if (chatId !== 0) {
      logger.add(
        new TelegramTransport(chatId, {
          level: level.toLowerCase(),
          // Match the file transport format for consistency
          format: DEFAULT_CONFIG.file.format,
        }),
      );
    }
  }

  return {
    logger,
    addFileTransport,
    addTelegramTransport,
    updateConsoleLevel,
  };
}

interface TimeoutState {
  lastReset: DateTime;
  notifiedTimeout: boolean;
}

/**
 * A Winston transport for sending logs to Telegram.
 * Implements rate limiting and message chunking for better handling of log messages.
 *
 * @class TelegramTransport
 * @extends {Transport}
 *
 * @property {number} maxLogsPerMinute - Maximum number of logs that can be sent per minute (default: 10)
 * @property {LogCounter} counter - Tracks the number of logs sent within the current minute
 *
 * @example
 * ```typescript
 * const telegramTransport = new TelegramTransport(chatId);
 * logger.add(telegramTransport);
 * ```
 *
 * Features:
 * - Rate limiting to prevent spam (10 messages per minute)
 * - Automatic message chunking for long messages
 * - Stack trace formatting
 * - Markdown support
 * - Timeout handling for API calls
 *
 * @throws {Error} When Telegram API calls timeout (after 5 seconds)
 */
class TelegramTransport extends Transport {
  private timeoutState: TimeoutState = {
    lastReset: DateTime.now(),
    notifiedTimeout: false,
  };

  constructor(
    private readonly botLogChatId: number,
    opts?: Transport.TransportStreamOptions,
  ) {
    super(opts);
  }

  private resetTimeoutStateIfNeeded(): void {
    const now = DateTime.now();
    if (now.diff(this.timeoutState.lastReset).as("minutes") >= 1) {
      this.timeoutState = {
        lastReset: now,
        notifiedTimeout: false,
      };
    }
  }

  override async log(
    info: LogEntry & { timestamp: string; stack?: string },
    callback: () => void,
  ) {
    setImmediate(() => this.emit("logged", info));
    if (this.botLogChatId) {
      await this.handleLogMessage(info);
    }
    callback();
  }

  private async handleLogMessage(
    info: LogEntry & { timestamp: string; stack?: string },
  ) {
    const telegramMessage = this.formatTelegramMessage(info);
    await this.sendMessageInChunks(telegramMessage);
  }

  private async handleTimeout(): Promise<void> {
    this.resetTimeoutStateIfNeeded();

    if (!this.timeoutState.notifiedTimeout) {
      try {
        // Send warning without timeout to ensure delivery
        await telegramBotService
          .getBot()
          .api.sendMessage(
            this.botLogChatId,
            "⚠️ Message delivery is taking longer than expected. Some log messages may be delayed or missing. Please check the log file for complete information.",
          );
        this.timeoutState.notifiedTimeout = true;
      } catch (error) {
        console.error("Failed to send timeout warning message:", error);
      }
    }
  }

  private formatTelegramMessage(
    info: LogEntry & { timestamp: string; stack?: string },
  ): string {
    try {
      const level = info.level.toUpperCase() || "INFO";
      const messageText = (() => {
        try {
          return typeof info.message === "string"
            ? info.message
            : JSON.stringify(info.message);
        } catch {
          return "[Unparseable message]";
        }
      })();

      const icon = level === "ERROR" ? "❌" : level === "WARN" ? "⚠️" : "ℹ️";
      let message = escapeText(`${icon} ${messageText}`);

      if (info.stack) {
        message += `\n\n${bold("Stack:")}\n\`\`\`\n${escapeCode(info.stack)}\n\`\`\``;
      }

      return message;
    } catch {
      // If everything fails, return a generic error message
      return escapeText("❌ Error formatting log message");
    }
  }

  private async sendMessageInChunks(message: string) {
    const chunks = splitIntoChunks(message, 4000);
    for (const chunk of chunks) {
      try {
        await this.sendWithTimeout(this.botLogChatId, chunk, {
          parse_mode: "MarkdownV2",
        });
      } catch {
        await this.handleTimeout();
      }
    }
  }

  private async sendWithTimeout(
    chatId: number,
    message: string,
    options: object = {},
  ): Promise<void> {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error("Telegram API timeout"));
      }, 5000);
    });
    await Promise.race([
      telegramBotService.getBot().api.sendMessage(chatId, message, options),
      timeoutPromise,
    ]);
  }
}

const { logger, addFileTransport, addTelegramTransport, updateConsoleLevel } =
  createLoggerInstance();

export { logger, addFileTransport, addTelegramTransport, updateConsoleLevel };

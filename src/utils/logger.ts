import { resolve } from "node:path";
import { telegramBotService } from "@/bot/service";
import { bold, escapeText } from "@/bot/utils/markdown";
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

interface LogCounter {
  count: number;
  lastReset: DateTime;
  notifiedLimit: boolean;
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
  private readonly maxLogsPerMinute = 10;
  private counter: LogCounter = {
    count: 0,
    lastReset: DateTime.now(),
    notifiedLimit: false,
  };

  constructor(
    private readonly botLogChatId: number,
    opts?: Transport.TransportStreamOptions,
  ) {
    super(opts);
  }

  private resetCounterIfNeeded(): void {
    const now = DateTime.now();
    if (now.diff(this.counter.lastReset).as("minutes") >= 1) {
      this.counter = {
        count: 0,
        lastReset: now,
        notifiedLimit: false,
      };
    }
  }

  override async log(
    info: LogEntry & { timestamp: string; stack?: string },
    callback: () => void,
  ) {
    try {
      setImmediate(() => this.emit("logged", info));

      if (!this.botLogChatId) {
        callback();
        return;
      }

      await this.handleLogMessage(info);
    } catch (error) {
      console.error("Failed to send log to Telegram:", error);
    } finally {
      callback();
    }
  }

  private async handleLogMessage(
    info: LogEntry & { timestamp: string; stack?: string },
  ) {
    if (await this.handleRateLimiting()) {
      return;
    }

    const telegramMessage = this.formatTelegramMessage(info);
    await this.sendMessageInChunks(telegramMessage);
  }

  private async handleRateLimiting(): Promise<boolean> {
    this.resetCounterIfNeeded();

    if (this.counter.count < this.maxLogsPerMinute) {
      return false;
    }

    if (!this.counter.notifiedLimit) {
      await this.sendWithTimeout(
        this.botLogChatId,
        "⚠️ High log volume detected: 10+ entries in the past minute. Log notifications paused for cooldown. Please review the log file for details.",
      );
      this.counter.notifiedLimit = true;
    }

    return true;
  }

  private formatTelegramMessage(
    info: LogEntry & { timestamp: string; stack?: string },
  ): string {
    const level = info.level.toUpperCase();
    const messageText =
      typeof info.message === "string"
        ? info.message
        : JSON.stringify(info.message);

    const icon = level === "ERROR" ? "❌" : level === "WARN" ? "⚠️" : "ℹ️";
    let message = escapeText(`${icon} ${messageText}`);

    if (info.stack) {
      message += `\n\n${bold("Stack:")}\n\`\`\`\n${escapeText(info.stack)}\n\`\`\``;
    }

    return message;
  }

  private async sendMessageInChunks(message: string) {
    const chunks = splitIntoChunks(message, 4000);

    for (const chunk of chunks) {
      await this.sendWithTimeout(this.botLogChatId, chunk, {
        parse_mode: "MarkdownV2",
      });
      this.counter.count++;
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

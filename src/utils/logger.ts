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
    setImmediate(() => {
      this.emit("logged", info);
    });

    // Only send logs if we have a valid chat ID
    if (!this.botLogChatId) {
      callback();
      return;
    }

    try {
      this.resetCounterIfNeeded();

      // Never wait more than 5 seconds for the log to be sent
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error("Telegram API timeout"));
        }, 1000);
      });

      // If we're at the limit, only send the limit message once per minute
      // to avoid spamming the chat
      if (this.counter.count >= this.maxLogsPerMinute) {
        if (!this.counter.notifiedLimit) {
          await Promise.race([
            await telegramBotService
              .getBot()
              .api.sendMessage(
                this.botLogChatId,
                "⚠️ More than 10 logs in the last minute. Check your instance for details.",
                {},
              ),
            timeoutPromise,
          ]);

          this.counter.notifiedLimit = true;
        }
        callback();
        return;
      }

      const level = info.level.toUpperCase();
      const messageText =
        typeof info.message === "string"
          ? info.message
          : JSON.stringify(info.message);

      let telegramMessage = escapeText(`⚠️ [${level}] ${messageText}`);
      if (info.stack) {
        telegramMessage += `
  
  ${bold("Stack:")}
  \`\`\`
  ${escapeText(info.stack)}
  \`\`\``;
      }

      // Send the error message in chunks since stack traces can be long
      const chunks = splitIntoChunks(telegramMessage, 4000);

      for (const chunk of chunks) {
        await telegramBotService
          .getBot()
          .api.sendMessage(this.botLogChatId, chunk, {
            parse_mode: "MarkdownV2",
          });
        this.counter.count++;
      }
    } catch (error) {
      console.error("Failed to send log to Telegram:", error);
    }

    callback();
  }
}

const { logger, addFileTransport, addTelegramTransport, updateConsoleLevel } =
  createLoggerInstance();

export { logger, addFileTransport, addTelegramTransport, updateConsoleLevel };

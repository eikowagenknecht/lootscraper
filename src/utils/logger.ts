import { resolve } from "node:path";
import type { Format, TransformableInfo } from "logform";
import { DateTime } from "luxon";
import { createLogger, format, transports } from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { getDataPath } from "./path";

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

  return {
    logger,
    initializeFileTransport: addFileTransport,
    updateConsoleLevel,
  };
}

const { logger, initializeFileTransport, updateConsoleLevel } =
  createLoggerInstance();

export { logger, initializeFileTransport, updateConsoleLevel };

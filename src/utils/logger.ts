import { resolve } from "node:path";
import { config } from "@/services/config";
import type { TransformableInfo } from "logform";
import { createLogger, format, transports } from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

function createLoggerInstance() {
  const consoleFormat = format.printf((info: TransformableInfo) => {
    const timestamp = (info.timestamp as string) || new Date().toISOString();
    const message = info.message as string;
    const level = info.level;

    return `${timestamp} [${level}] ${message}`;
  });

  const logger = createLogger({});

  // Log to console in custom format.
  logger.add(
    new transports.Console({
      level: "debug",
      format: format.combine(format.timestamp(), consoleFormat),
    }),
  );

  // Add file transport after config is loaded
  function initializeFileTransport() {
    const { logFile, logLevel } = config.get().common;

    // Log to file in JSON format.
    logger.add(
      new DailyRotateFile({
        filename: resolve(process.cwd(), "data", "log", logFile),
        datePattern: "YYYY-MM-DD",
        zippedArchive: true,
        maxSize: "20m",
        maxFiles: "14d",
        level: logLevel.toLowerCase(),
        format: format.combine(format.timestamp(), format.json()),
      }),
    );
  }

  return {
    logger,
    initializeFileTransport,
  };
}

const { logger, initializeFileTransport } = createLoggerInstance();

export { logger, initializeFileTransport };

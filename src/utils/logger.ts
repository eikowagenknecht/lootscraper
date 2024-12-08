import { resolve } from "node:path";
import { config } from "@/services/config";
import { createLogger, format, transports } from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

// const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
//   let msg = `${timestamp} [${level}] ${message}`;

//   if (Object.keys(metadata).length > 0) {
//     msg += ` ${JSON.stringify(metadata)}`;
//   }

//   return msg;
// });

function createLoggerInstance() {
  const logger = createLogger({
    format: format.combine(format.timestamp(), format.simple()),
    transports: [
      new transports.Console({
        level: "info",
      }),
    ],
  });

  //
  // If we're not in production then log to the `console` with the format:
  // `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
  //
  if (process.env.NODE_ENV !== "production") {
    logger.add(
      new transports.Console({
        format: format.simple(),
      }),
    );
  }

  // Add file transport after config is loaded
  function initializeFileTransport() {
    const { logFile, logLevel } = config.get().common;

    // TODO: Split into error and rest, see https://github.com/winstonjs/winston example
    logger.add(
      new DailyRotateFile({
        filename: resolve(process.cwd(), "data", "log", logFile),
        datePattern: "YYYY-MM-DD",
        zippedArchive: true,
        maxSize: "20m",
        maxFiles: "14d",
        level: logLevel.toLowerCase(),
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

import { config } from "@/services/config";
import { shutdownApp, startApp } from "@/services/orchestrator";
import { handleError } from "@/utils/errorHandler";
import { addFileTransport, logger, updateConsoleLevel } from "@/utils/logger";
import { Settings as LuxonSettings } from "luxon";
import { getPackageInfo } from "./utils/version";

async function initializeCore() {
  // Load config first as other services depend on it
  config.loadConfig();
  const cfg = config.get();

  // Configure logging based on config
  const configuredLevel = cfg.common.logLevel;
  updateConsoleLevel(configuredLevel);
  addFileTransport(configuredLevel, cfg.common.logFile);

  // Log version number
  const appInfo = await getPackageInfo();
  logger.info(`Starting ${appInfo.name} v${appInfo.version}.`);

  // Log debug information
  if (process.env.DEBUG) {
    logger.info(`DEBUG env is set to ${process.env.DEBUG}.`);
  }

  // Set timezone for consistent date handling
  LuxonSettings.defaultZone = "utc";
  LuxonSettings.defaultLocale = "en-US";
  LuxonSettings.throwOnInvalid = true;

  logger.info(
    `Core initialized. Logging with level ${configuredLevel} from now on.`,
  );
}

/**
 * Main function to start the application.
 * Initializes core services like logging and config parsing first and then
 * starts application services (database, translation, etc.).
 */
async function main(): Promise<void> {
  await initializeCore();
  await startApp();
}

try {
  await main();
} catch (error) {
  handleError(error);
  await shutdownApp();
  process.exit(1);
}

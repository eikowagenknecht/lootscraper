import { config } from "@/services/config";
import { initializeServices, shutdownServices } from "@/services/orchestrator";
import { handleError } from "@/utils/errorHandler";
import {
  initializeFileTransport,
  logger,
  updateConsoleLevel,
} from "@/utils/logger";
import { Settings as LuxonSettings } from "luxon";

function initializeCore() {
  // Load config first as other services depend on it
  config.loadConfig();
  const cfg = config.get();

  // Configure logging based on config
  const configuredLevel = cfg.common.logLevel;
  updateConsoleLevel(configuredLevel);
  initializeFileTransport(configuredLevel, cfg.common.logFile);

  // Log debug information
  if (process.env.DEBUG) {
    logger.info(`DEBUG env is set to ${process.env.DEBUG}`);
  }

  // Set timezone for consistent date handling
  LuxonSettings.defaultZone = "utc";
  LuxonSettings.defaultLocale = "en-US";
  LuxonSettings.throwOnInvalid = true;

  logger.info("Core services initialized");
}

async function main(): Promise<void> {
  try {
    // Initialize core services first (logging, config)
    initializeCore();

    // Initialize and start application services
    await initializeServices();
    logger.info("Application started successfully");
  } catch (error) {
    handleError(error);
    await shutdownServices();
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  handleError(error);
  void shutdownServices();
  process.exit(1);
});

import { config } from "@/services/config";
import { handleError } from "@/utils/errorHandler";
import { initializeFileTransport, logger } from "@/utils/logger";

// eslint-disable-next-line @typescript-eslint/require-await
async function main(): Promise<void> {
  try {
    // Load config first
    config.loadConfig();

    // Initialize file logging
    initializeFileTransport();

    logger.info("Starting LootScraper...");

    // TODO: Initialize other services
  } catch (error) {
    handleError(error);
    process.exit(1);
  }
}

main().catch(handleError);

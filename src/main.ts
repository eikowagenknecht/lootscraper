import { logger } from "@/utils/logger";

// eslint-disable-next-line @typescript-eslint/require-await
async function main() {
  logger.info("Starting LootScraper...");
  // TODO: Implement
}

main().catch((error: unknown) => {
  logger.error("Fatal error:", error);
  process.exit(1);
});

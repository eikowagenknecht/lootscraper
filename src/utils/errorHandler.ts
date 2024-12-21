import { LootScraperError } from "@/types/errors";
import { logger } from "./logger";

export function handleError(error: unknown): void {
  if (error instanceof LootScraperError) {
    logger.error(error.message);
    return;
  }

  if (error instanceof Error) {
    logger.error("Unexpected error:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    return;
  }

  logger.error("Unknown error:", { error });
}

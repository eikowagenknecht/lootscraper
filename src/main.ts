import { logger } from '@/utils/logger';

async function main() {
  logger.info('Starting LootScraper...');
  // TODO: Implement
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
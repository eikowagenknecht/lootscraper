import { logger } from "@/utils/logger";
import { sql } from "kysely";
import type { Kysely } from "kysely";

export const scrapingRunsMigration = {
  async up(db: Kysely<unknown>): Promise<void> {
    logger.info("Running migration: 007-scrapingruns");
    await db.transaction().execute(async (trx) => {
      await trx.schema
        .createTable("scraping_runs")
        .addColumn("id", "integer", (col) => col.primaryKey().notNull())
        .addColumn("scraper", "text", (col) => col.notNull())
        .addColumn("scheduled_date", "text", (col) => col.notNull()) // SQLite doesn't have a native datetime type
        .addColumn("started_date", "text") // SQLite doesn't have a native datetime type
        .addColumn("finished_date", "text") // SQLite doesn't have a native datetime type
        .addColumn("offers_found", "integer")
        .addColumn("offers_new", "integer")
        .addColumn("offers_modified", "integer")
        .modifyEnd(sql`strict`)
        .execute();

      logger.info("Migration successful");
    });
  },
};

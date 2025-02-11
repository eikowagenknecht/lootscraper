import { logger } from "@/utils/logger";
import { sql } from "kysely";
import type { Kysely } from "kysely";

export const hashesMigration = {
  async up(db: Kysely<unknown>): Promise<void> {
    logger.info("Running migration: 010-hashes");
    await db.transaction().execute(async (trx) => {
      await trx.schema
        .createTable("hashes")
        .addColumn("id", "integer", (col) => col.primaryKey().notNull())
        .addColumn("resource_name", "text")
        .addColumn("hash_value", "text")
        .addColumn("last_updated", "text") // SQLite doesn't have a native datetime type
        .modifyEnd(sql`strict`)
        .execute();
    });
  },
};

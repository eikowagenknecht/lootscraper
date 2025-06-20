import type { Kysely } from "kysely";
import { logger } from "@/utils/logger";

export const dropAlembicMigration = {
  async up(db: Kysely<unknown>): Promise<void> {
    logger.info("Running migration: 002-alembic");
    await db.transaction().execute(async (trx) => {
      await trx.schema.dropTable("alembic_version").execute();
    });

    logger.info("Migration successful");
  },
};

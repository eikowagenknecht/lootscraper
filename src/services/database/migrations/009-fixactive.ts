import { logger } from "@/utils/logger";
import { sql } from "kysely";
import type { Kysely } from "kysely";

export const fixActiveMigration = {
  async up(db: Kysely<unknown>): Promise<void> {
    logger.info("Running migration: 009-fixactive");
    await db.transaction().execute(async (trx) => {
      // Some chats have not been marked as inactive even though they should be
      // in the old Python code. This migration fixes that.
      await sql`\
UPDATE telegram_chats
SET active = 0
WHERE inactive_reason IS NOT NULL;
`.execute(trx);
    });
  },
};

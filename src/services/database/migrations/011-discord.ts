import type { Kysely } from "kysely";
import { sql } from "kysely";
import { logger } from "@/utils/logger";

export const discordMigration = {
  async up(db: Kysely<unknown>): Promise<void> {
    logger.info("Running migration: 011-discord");
    await db.transaction().execute(async (trx) => {
      await trx.schema
        .createTable("discord_channels")
        .addColumn("id", "integer", (col) => col.primaryKey().notNull())
        .addColumn("channel_id", "text", (col) => col.notNull())
        .addColumn("source", "text", (col) => col.notNull())
        .addColumn("type", "text", (col) => col.notNull())
        .addColumn("duration", "text", (col) => col.notNull())
        .addColumn("platform", "text", (col) => col.notNull())
        .addColumn("last_offer_id", "integer", (col) =>
          col.notNull().defaultTo(0),
        )
        .addColumn("created_at", "text", (col) => col.notNull())
        .addUniqueConstraint("discord_channels_combination_unique", [
          "source",
          "type",
          "duration",
          "platform",
        ])
        .modifyEnd(sql`strict`)
        .execute();

      // Index for querying channels by combination
      await trx.schema
        .createIndex("discord_channels_combination_idx")
        .on("discord_channels")
        .columns(["source", "type", "duration", "platform"])
        .execute();
    });
  },
};

import type { Kysely } from "kysely";
import { sql } from "kysely";
import { logger } from "@/utils/logger";

export const nullabilityMigration = {
  async up(db: Kysely<unknown>): Promise<void> {
    logger.info("Running migration: 004-nullability");
    await db.transaction().execute(async (trx) => {
      // offers table - make seen_first not nullable and change column order
      await trx.schema
        .createTable("offers_new")
        .addColumn("id", "integer", (col) => col.primaryKey().notNull())
        .addColumn("source", "varchar(7)", (col) => col.notNull())
        .addColumn("type", "varchar(4)", (col) => col.notNull())
        .addColumn("duration", "varchar(9)", (col) => col.notNull())
        .addColumn("category", "varchar(10)", (col) => col.notNull())
        .addColumn("title", "varchar", (col) => col.notNull())
        .addColumn("probable_game_name", "varchar", (col) => col.notNull())
        .addColumn("game_id", "integer", (col) => col.references("games.id"))
        .addColumn("seen_first", "datetime", (col) => col.notNull())
        .addColumn("seen_last", "datetime", (col) => col.notNull())
        .addColumn("valid_from", "datetime")
        .addColumn("valid_to", "datetime")
        .addColumn("rawtext", "json")
        .addColumn("url", "varchar")
        .addColumn("img_url", "varchar")
        .execute();
      await sql`\
INSERT INTO offers_new (
  id, source, type, duration, category, title, 
  probable_game_name, game_id, seen_first, seen_last,
  valid_from, valid_to, rawtext, url, img_url
)
SELECT 
  id, source, type, duration, category, title,
  probable_game_name, game_id, seen_first, seen_last,
  valid_from, valid_to, rawtext, url, img_url
FROM offers
WHERE seen_first IS NOT NULL`.execute(trx);
      await trx.schema.dropTable("offers").execute();
      await sql`ALTER TABLE offers_new RENAME TO offers`.execute(trx);
    });

    logger.info("Migration successful");
  },
};

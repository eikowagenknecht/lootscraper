import { sql } from "kysely";
import type { Kysely } from "kysely";

export const nullabilityMigration = {
  async up(db: Kysely<unknown>): Promise<void> {
    // offers table - make seen_first not nullable
    await db.schema
      .createTable("offers_new")
      .addColumn("id", "integer", (col) => col.primaryKey().notNull())
      .addColumn("source", "varchar(7)", (col) => col.notNull())
      .addColumn("type", "varchar(4)", (col) => col.notNull())
      .addColumn("title", "varchar", (col) => col.notNull())
      .addColumn("seen_first", "datetime", (col) => col.notNull())
      .addColumn("seen_last", "datetime", (col) => col.notNull())
      .addColumn("valid_from", "datetime")
      .addColumn("valid_to", "datetime")
      .addColumn("rawtext", "json")
      .addColumn("url", "varchar")
      .addColumn("img_url", "varchar")
      .addColumn("game_id", "integer", (col) => col.references("games.id"))
      .addColumn("probable_game_name", "varchar", (col) => col.notNull())
      .addColumn("duration", "varchar(9)", (col) => col.notNull())
      .addColumn("category", "varchar(10)", (col) => col.notNull())
      .execute();
    await sql`INSERT INTO offers_new SELECT * FROM offers WHERE seen_first IS NOT NULL`.execute(
      db,
    );
    await db.schema.dropTable("offers").execute();
    await sql`ALTER TABLE offers_new RENAME TO offers`.execute(db);
  },
};

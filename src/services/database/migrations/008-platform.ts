import { sql } from "kysely";
import type { Kysely } from "kysely";

export const platformMigration = {
  async up(db: Kysely<unknown>): Promise<void> {
    // Temporarily disable foreign key constraints
    await sql`PRAGMA foreign_keys = OFF`.execute(db);

    // offers table
    await db.schema
      .createTable("offers_new")
      .addColumn("id", "integer", (col) => col.primaryKey().notNull())
      .addColumn("source", "text", (col) => col.notNull())
      .addColumn("type", "text", (col) => col.notNull())
      .addColumn("duration", "text", (col) => col.notNull())
      .addColumn("platform", "text", (col) => col.notNull())
      .addColumn("category", "text", (col) => col.notNull())
      .addColumn("title", "text", (col) => col.notNull())
      .addColumn("probable_game_name", "text", (col) => col.notNull())
      .addColumn("game_id", "integer", (col) => col.references("games.id"))
      .addColumn("seen_first", "text", (col) => col.notNull()) // SQLite doesn't have a native datetime type
      .addColumn("seen_last", "text", (col) => col.notNull())
      .addColumn("valid_from", "text")
      .addColumn("valid_to", "text")
      .addColumn("rawtext", "text") // JSON will be stored as TEXT
      .addColumn("url", "text")
      .addColumn("img_url", "text")
      .modifyEnd(sql`strict`)
      .execute();

    // telegram_subscriptions table
    await db.schema
      .createTable("telegram_subscriptions_new")
      .addColumn("id", "integer", (col) => col.primaryKey().notNull())
      .addColumn("chat_id", "integer", (col) =>
        col.references("telegram_chats.id").notNull(),
      )
      .addColumn("source", "text", (col) => col.notNull())
      .addColumn("type", "text", (col) => col.notNull())
      .addColumn("platform", "text", (col) => col.notNull())
      .addColumn("last_offer_id", "integer", (col) => col.notNull())
      .addColumn("duration", "text", (col) => col.notNull())
      .modifyEnd(sql`strict`)
      .execute();

    // Copy data with explicit column specifications
    // Set a default value for the new column "platform"
    // It's "PC" for all existing offers with the exceptions:
    // Source "GOOGLE" -> "ANDROID"
    // Source "APPLE" -> "IOS"
    await sql`\
INSERT INTO offers_new (
  id, source, type, title, seen_first, seen_last,
  valid_from, valid_to, rawtext, url, img_url, game_id,
  probable_game_name, duration, category, platform
)
SELECT 
  id, source, type, title, seen_first, seen_last,
  valid_from, valid_to, rawtext, url, img_url, game_id,
  probable_game_name, duration, category,
  CASE
    WHEN source = 'GOOGLE' THEN 'ANDROID'
    WHEN source = 'APPLE' THEN 'IOS'
    ELSE 'PC'
  END as platform
FROM offers;
`.execute(db);

    await sql`\
INSERT INTO telegram_subscriptions_new (
  id, chat_id, source, type, last_offer_id, duration, platform
)
SELECT 
  id, chat_id, source, type, last_offer_id, duration,
  CASE
    WHEN source = 'GOOGLE' THEN 'ANDROID'
    WHEN source = 'APPLE' THEN 'IOS'
    ELSE 'PC'
  END as platform
FROM telegram_subscriptions;
`.execute(db);

    // Drop old tables
    await db.schema.dropTable("offers").execute();
    await db.schema.dropTable("telegram_subscriptions").execute();

    // Rename new tables
    await sql`ALTER TABLE offers_new RENAME TO offers`.execute(db);
    await sql`ALTER TABLE telegram_subscriptions_new RENAME TO telegram_subscriptions`.execute(
      db,
    );

    // Re-enable foreign key constraints
    await sql`PRAGMA foreign_keys = ON`.execute(db);

    // Verify the integrity of foreign keys
    await sql`PRAGMA foreign_key_check`.execute(db);
  },
};

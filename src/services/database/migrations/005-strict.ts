import type { Kysely } from "kysely";
import { sql } from "kysely";
import { logger } from "@/utils/logger";

export const strictModeMigration = {
  async up(db: Kysely<unknown>): Promise<void> {
    logger.info("Running migration: 005-strict");
    try {
      await sql`PRAGMA foreign_keys = OFF`.execute(db);
      await db.transaction().execute(async (trx) => {
        // Temporarily disable foreign key constraints

        // igdb_info table
        await trx.schema
          .createTable("igdb_info_new")
          .addColumn("id", "integer", (col) => col.primaryKey().notNull())
          .addColumn("name", "text")
          .addColumn("url", "text")
          .addColumn("short_description", "text")
          .addColumn("release_date", "text") // SQLite doesn't have a native datetime type
          .addColumn("user_score", "integer")
          .addColumn("user_ratings", "integer")
          .addColumn("meta_score", "integer")
          .addColumn("meta_ratings", "integer")
          .modifyEnd(sql`strict`)
          .execute();

        // steam_info table
        await trx.schema
          .createTable("steam_info_new")
          .addColumn("id", "integer", (col) => col.primaryKey().notNull())
          .addColumn("name", "text")
          .addColumn("url", "text", (col) => col.notNull())
          .addColumn("short_description", "text")
          .addColumn("release_date", "text") // SQLite doesn't have a native datetime type
          .addColumn("genres", "text")
          .addColumn("publishers", "text")
          .addColumn("image_url", "text")
          .addColumn("recommendations", "integer")
          .addColumn("percent", "integer")
          .addColumn("score", "integer")
          .addColumn("metacritic_score", "integer")
          .addColumn("metacritic_url", "text")
          .addColumn("recommended_price_eur", "real")
          .modifyEnd(sql`strict`)
          .execute();

        // games table
        await trx.schema
          .createTable("games_new")
          .addColumn("id", "integer", (col) => col.primaryKey().notNull())
          .addColumn("igdb_id", "integer", (col) =>
            col.references("igdb_info.id"),
          )
          .addColumn("steam_id", "integer", (col) =>
            col.references("steam_info.id"),
          )
          .modifyEnd(sql`strict`)
          .execute();

        // announcements table
        await trx.schema
          .createTable("announcements_new")
          .addColumn("id", "integer", (col) => col.primaryKey().notNull())
          .addColumn("channel", "text", (col) => col.notNull())
          .addColumn("date", "text", (col) => col.notNull()) // SQLite doesn't have a native datetime type
          .addColumn("text_markdown", "text", (col) => col.notNull())
          .modifyEnd(sql`strict`)
          .execute();

        // offers table
        await trx.schema
          .createTable("offers_new")
          .addColumn("id", "integer", (col) => col.primaryKey().notNull())
          .addColumn("source", "text", (col) => col.notNull())
          .addColumn("type", "text", (col) => col.notNull())
          .addColumn("duration", "text", (col) => col.notNull())
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

        // telegram_chats table
        await trx.schema
          .createTable("telegram_chats_new")
          .addColumn("id", "integer", (col) => col.primaryKey().notNull())
          .addColumn("registration_date", "text", (col) => col.notNull())
          .addColumn("chat_type", "text", (col) => col.notNull())
          .addColumn("chat_id", "integer", (col) => col.notNull())
          .addColumn("user_id", "integer")
          .addColumn("thread_id", "integer")
          .addColumn("chat_details", "text") // JSON will be stored as TEXT
          .addColumn("user_details", "text") // JSON will be stored as TEXT
          .addColumn("timezone_offset", "integer", (col) => col.notNull())
          .addColumn("active", "integer", (col) => col.notNull()) // SQLite doesn't have a native boolean type
          .addColumn("inactive_reason", "text")
          .addColumn("offers_received_count", "integer", (col) => col.notNull())
          .addColumn("last_announcement_id", "integer", (col) => col.notNull())
          .modifyEnd(sql`strict`)
          .execute();

        // telegram_subscriptions table
        await trx.schema
          .createTable("telegram_subscriptions_new")
          .addColumn("id", "integer", (col) => col.primaryKey().notNull())
          .addColumn("chat_id", "integer", (col) =>
            col.references("telegram_chats.id").notNull(),
          )
          .addColumn("source", "text", (col) => col.notNull())
          .addColumn("type", "text", (col) => col.notNull())
          .addColumn("last_offer_id", "integer", (col) => col.notNull())
          .addColumn("duration", "text", (col) => col.notNull())
          .modifyEnd(sql`strict`)
          .execute();

        // Copy data with explicit column specifications
        await sql`\
INSERT INTO igdb_info_new (id, url, name, short_description, release_date, 
  user_score, user_ratings, meta_score, meta_ratings)
SELECT id, url, name, short_description, release_date, 
  user_score, user_ratings, meta_score, meta_ratings
FROM igdb_info
`.execute(trx);

        await sql`\
INSERT INTO steam_info_new (id, url, name, short_description, release_date,
  genres, publishers, image_url, recommendations, percent, score,
  metacritic_score, metacritic_url, recommended_price_eur)
SELECT id, url, name, short_description, release_date,
  genres, publishers, image_url, recommendations, percent, score,
  metacritic_score, metacritic_url, recommended_price_eur
FROM steam_info
`.execute(trx);

        await sql`\
INSERT INTO games_new (id, igdb_id, steam_id)
SELECT id, igdb_id, steam_id
FROM games
`.execute(trx);

        await sql`\
INSERT INTO announcements_new (id, channel, date, text_markdown)
SELECT id, channel, date, text_markdown
FROM announcements
`.execute(trx);

        await sql`\
INSERT INTO offers_new (id, source, type, title, seen_first, seen_last,
  valid_from, valid_to, rawtext, url, img_url, game_id,
  probable_game_name, duration, category)
SELECT id, source, type, title, seen_first, seen_last,
  valid_from, valid_to, rawtext, url, img_url, game_id,
  probable_game_name, duration, category
FROM offers
`.execute(trx);

        await sql`\
INSERT INTO telegram_chats_new (id, registration_date, chat_type, chat_id,
  user_id, thread_id, chat_details, user_details, timezone_offset,
  active, inactive_reason, offers_received_count, last_announcement_id)
SELECT id, registration_date, chat_type, chat_id,
  user_id, thread_id, chat_details, user_details, timezone_offset,
  CASE WHEN active = true THEN 1 ELSE 0 END,
  inactive_reason, offers_received_count, last_announcement_id
FROM telegram_chats
`.execute(trx);

        await sql`\
INSERT INTO telegram_subscriptions_new (id, chat_id, source, type,
  last_offer_id, duration)
SELECT id, chat_id, source, type, last_offer_id, duration
FROM telegram_subscriptions
`.execute(trx);

        // Drop old tables
        await trx.schema.dropTable("telegram_subscriptions").execute();
        await trx.schema.dropTable("telegram_chats").execute();
        await trx.schema.dropTable("offers").execute();
        await trx.schema.dropTable("announcements").execute();
        await trx.schema.dropTable("games").execute();
        await trx.schema.dropTable("steam_info").execute();
        await trx.schema.dropTable("igdb_info").execute();

        // Rename new tables
        await sql`ALTER TABLE igdb_info_new RENAME TO igdb_info`.execute(trx);
        await sql`ALTER TABLE steam_info_new RENAME TO steam_info`.execute(trx);
        await sql`ALTER TABLE games_new RENAME TO games`.execute(trx);
        await sql`ALTER TABLE announcements_new RENAME TO announcements`.execute(
          trx,
        );
        await sql`ALTER TABLE offers_new RENAME TO offers`.execute(trx);
        await sql`ALTER TABLE telegram_chats_new RENAME TO telegram_chats`.execute(
          trx,
        );
        await sql`ALTER TABLE telegram_subscriptions_new RENAME TO telegram_subscriptions`.execute(
          trx,
        );

        // Add unique constraints
        await trx.schema
          .createIndex("unique_chat")
          .on("telegram_chats")
          .expression(
            sql`chat_id, COALESCE(user_id, -1), COALESCE(thread_id, -1)`,
          )
          .unique()
          .execute();
      });
      // Re-enable foreign key constraints and verify them
      await sql`PRAGMA foreign_keys = ON`.execute(db);
      await sql`PRAGMA foreign_key_check`.execute(db);

      logger.info("Migration successful");
    } catch (error) {
      // Re-enable foreign key constraints
      await sql`PRAGMA foreign_keys = ON`.execute(db);
      throw error;
    }
  },
};

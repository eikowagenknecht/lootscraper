import type { Kysely } from "kysely";

export const initialMigration = {
  async up(db: Kysely<unknown>): Promise<void> {
    // alembic_version table
    await db.schema
      .createTable("alembic_version")
      .addColumn("version_num", "text", (col) => col.notNull())
      .execute();

    // igdb_info table - needs to be before games for references
    await db.schema
      .createTable("igdb_info")
      .addColumn("id", "integer", (col) => col.primaryKey().notNull())
      .addColumn("url", "varchar")
      .addColumn("name", "varchar")
      .addColumn("short_description", "varchar")
      .addColumn("release_date", "datetime")
      .addColumn("user_score", "integer")
      .addColumn("user_ratings", "integer")
      .addColumn("meta_score", "integer")
      .addColumn("meta_ratings", "integer")
      .execute();

    // steam_info table - needs to be before games for references
    await db.schema
      .createTable("steam_info")
      .addColumn("id", "integer", (col) => col.primaryKey().notNull())
      .addColumn("url", "varchar", (col) => col.notNull())
      .addColumn("name", "varchar")
      .addColumn("short_description", "varchar")
      .addColumn("release_date", "datetime")
      .addColumn("genres", "varchar")
      .addColumn("publishers", "varchar")
      .addColumn("image_url", "varchar")
      .addColumn("recommendations", "integer")
      .addColumn("percent", "integer")
      .addColumn("score", "integer")
      .addColumn("metacritic_score", "integer")
      .addColumn("metacritic_url", "varchar")
      .addColumn("recommended_price_eur", "real")
      .execute();

    // games table
    await db.schema
      .createTable("games")
      .addColumn("id", "integer", (col) => col.primaryKey().notNull())
      .addColumn("igdb_id", "integer", (col) => col.references("igdb_info.id"))
      .addColumn("steam_id", "integer", (col) =>
        col.references("steam_info.id"),
      )
      .execute();

    // announcements table
    await db.schema
      .createTable("announcements")
      .addColumn("id", "integer", (col) => col.primaryKey().notNull())
      .addColumn("channel", "varchar(8)", (col) => col.notNull())
      .addColumn("date", "datetime", (col) => col.notNull())
      .addColumn("text_markdown", "varchar", (col) => col.notNull())
      .execute();

    // offers table
    await db.schema
      .createTable("offers")
      .addColumn("id", "integer", (col) => col.primaryKey().notNull())
      .addColumn("source", "varchar(7)", (col) => col.notNull())
      .addColumn("type", "varchar(4)", (col) => col.notNull())
      .addColumn("title", "varchar", (col) => col.notNull())
      .addColumn("seen_first", "datetime")
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

    // telegram_chats table
    await db.schema
      .createTable("telegram_chats")
      .addColumn("id", "integer", (col) => col.primaryKey().notNull())
      .addColumn("registration_date", "datetime", (col) => col.notNull())
      .addColumn("chat_type", "varchar(10)", (col) => col.notNull())
      .addColumn("chat_id", "integer", (col) => col.notNull())
      .addColumn("user_id", "integer")
      .addColumn("thread_id", "integer")
      .addColumn("chat_details", "json")
      .addColumn("user_details", "json")
      .addColumn("timezone_offset", "integer", (col) => col.notNull())
      .addColumn("active", "boolean", (col) => col.notNull())
      .addColumn("inactive_reason", "varchar")
      .addColumn("offers_received_count", "integer", (col) => col.notNull())
      .addColumn("last_announcement_id", "integer", (col) => col.notNull())
      .execute();

    // telegram_subscriptions table
    await db.schema
      .createTable("telegram_subscriptions")
      .addColumn("id", "integer", (col) => col.primaryKey().notNull())
      .addColumn("chat_id", "integer", (col) =>
        col.references("telegram_chats.id").notNull(),
      )
      .addColumn("source", "varchar(7)", (col) => col.notNull())
      .addColumn("type", "varchar(4)", (col) => col.notNull())
      .addColumn("last_offer_id", "integer", (col) => col.notNull())
      .addColumn("duration", "varchar(9)", (col) => col.notNull())
      .execute();
  },

  async down(db: Kysely<unknown>): Promise<void> {
    // Drop tables in reverse order of creation to handle foreign keys
    await db.schema.dropTable("telegram_subscriptions").execute();
    await db.schema.dropTable("telegram_chats").execute();
    await db.schema.dropTable("offers").execute();
    await db.schema.dropTable("games").execute();
    await db.schema.dropTable("steam_info").execute();
    await db.schema.dropTable("igdb_info").execute();
    await db.schema.dropTable("announcements").execute();
    await db.schema.dropTable("alembic_version").execute();
  },
};

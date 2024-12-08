import type { Kysely } from "kysely";

export const indicesMigration = {
  async up(db: Kysely<unknown>): Promise<void> {
    // Add indices
    await db.schema
      .createIndex("idx_games_igdb_id")
      .on("games")
      .column("igdb_id")
      .execute();

    await db.schema
      .createIndex("idx_games_steam_id")
      .on("games")
      .column("steam_id")
      .execute();

    await db.schema
      .createIndex("idx_offers_game_id")
      .on("offers")
      .column("game_id")
      .execute();

    await db.schema
      .createIndex("idx_offers_source_type_duration")
      .on("offers")
      .columns(["source", "type", "duration"])
      .execute();

    await db.schema
      .createIndex("idx_offers_seen_last")
      .on("offers")
      .column("seen_last")
      .execute();

    await db.schema
      .createIndex("idx_offers_valid_to")
      .on("offers")
      .column("valid_to")
      .execute();

    await db.schema
      .createIndex("idx_telegram_chats_chat_id")
      .on("telegram_chats")
      .column("chat_id")
      .execute();

    await db.schema
      .createIndex("idx_telegram_subscriptions_chat_id")
      .on("telegram_subscriptions")
      .column("chat_id")
      .execute();

    await db.schema
      .createIndex("idx_telegram_subscriptions_source_type_duration")
      .on("telegram_subscriptions")
      .columns(["source", "type", "duration"])
      .execute();
  },
};

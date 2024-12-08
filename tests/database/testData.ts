// import { OfferDuration, OfferSource, OfferType } from "@/types/config";
import type { Database } from "@/types/database";
import type { Kysely } from "kysely";

export async function insertTestData(db: Kysely<Database>) {
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const now = new Date();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // Insert announcements
  await db
    .insertInto("announcements")
    .values([
      {
        id: 1,
        channel: "TELEGRAM",
        date: twoDaysAgo.toISOString(),
        text_markdown: "Test announcement 1 (from yesterday)",
      },
      {
        id: 2,
        channel: "TELEGRAM",
        date: yesterday.toISOString(),
        text_markdown: "Test announcement 1 (from yesterday)",
      },
      {
        id: 3,
        channel: "TELEGRAM",
        date: now.toISOString(),
        text_markdown: "Test announcement 1 (from now)",
      },
      {
        id: 4,
        channel: "TELEGRAM",
        date: tomorrow.toISOString(),
        text_markdown: "Test announcement 1 (from yesterday)",
      },
    ])
    .execute();

  // // Insert IGDB info
  // await db
  //   .insertInto("igdb_info")
  //   .values({
  //     id: 123,
  //     name: "Test Game",
  //     url: "https://igdb.com/games/test",
  //     short_description: "A test game",
  //     release_date: new Date("2024-01-01").toISOString(),
  //     user_score: 85,
  //     user_ratings: 1000,
  //     meta_score: 88,
  //     meta_ratings: 50,
  //   })
  //   .execute();

  // // Insert Steam info
  // await db
  //   .insertInto("steam_info")
  //   .values({
  //     id: 234,
  //     url: "https://store.steampowered.com/app/test",
  //     name: "Test Game",
  //     short_description: "A test game on Steam",
  //     release_date: new Date("2024-01-01").toISOString(),
  //     genres: "Action,Adventure",
  //     publishers: "Test Publisher",
  //     image_url: "https://steam.com/test.jpg",
  //     recommendations: 5000,
  //     percent: 95,
  //     score: 9,
  //     metacritic_score: 88,
  //     metacritic_url: "https://metacritic.com/game/test",
  //     recommended_price_eur: 29.99,
  //   })
  //   .execute();

  // // Insert game
  // await db
  //   .insertInto("games")
  //   .values({
  //     id: 1,
  //     igdb_id: 123,
  //     steam_id: 234,
  //   })
  //   .execute();

  // // Insert offers
  // await db
  //   .insertInto("offers")
  //   .values([
  //     {
  //       id: 1,
  //       source: OfferSource.STEAM,
  //       type: OfferType.GAME,
  //       duration: OfferDuration.CLAIMABLE,
  //       title: "Test Game",
  //       probable_game_name: "Test Game",
  //       seen_last: now.toISOString(),
  //       valid_from: yesterday.toISOString(),
  //       valid_to: tomorrow.toISOString(),
  //       game_id: 1,
  //       category: "VALID",
  //       url: "https://store.steampowered.com/app/test",
  //     },
  //     {
  //       id: 2,
  //       source: OfferSource.EPIC,
  //       type: OfferType.GAME,
  //       duration: OfferDuration.CLAIMABLE,
  //       title: "Expired Game",
  //       probable_game_name: "Expired Game",
  //       seen_last: twoDaysAgo.toISOString(),
  //       valid_to: yesterday.toISOString(),
  //       category: "VALID",
  //     },
  //   ])
  //   .execute();

  // // Insert telegram chats
  // await db
  //   .insertInto("telegram_chats")
  //   .values([
  //     {
  //       id: 1,
  //       registration_date: now.toISOString(),
  //       chat_type: "private",
  //       chat_id: 123456,
  //       timezone_offset: 0,
  //       active: 1,
  //       offers_received_count: 0,
  //       last_announcement_id: 0,
  //     },
  //     {
  //       id: 2,
  //       registration_date: now.toISOString(),
  //       chat_type: "group",
  //       chat_id: 789012,
  //       timezone_offset: 1,
  //       active: 0,
  //       inactive_reason: "left_group",
  //       offers_received_count: 5,
  //       last_announcement_id: 0,
  //     },
  //   ])
  //   .execute();

  // // Insert telegram subscriptions
  // await db
  //   .insertInto("telegram_subscriptions")
  //   .values([
  //     {
  //       id: 1,
  //       chat_id: 1,
  //       source: OfferSource.STEAM,
  //       type: OfferType.GAME,
  //       duration: OfferDuration.CLAIMABLE,
  //       last_offer_id: 0,
  //     },
  //   ])
  //   .execute();
}

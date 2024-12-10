// import { OfferDuration, OfferSource, OfferType } from "@/types/config";
import { OfferDuration, OfferSource, OfferType } from "@/types/config";
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

  // Insert offers
  await db
    .insertInto("offers")
    .values([
      {
        id: 1,
        source: OfferSource.EPIC,
        type: OfferType.GAME,
        duration: OfferDuration.CLAIMABLE,
        title: "Existing Game 1",
        probable_game_name: "Existing Game 1",
        seen_first: yesterday.toISOString(),
        seen_last: yesterday.toISOString(),
        valid_from: yesterday.toISOString(),
        valid_to: tomorrow.toISOString(),
        rawtext: JSON.stringify({ title: "Existing Game 1" }),
        url: "https://example.com/game1",
        img_url: "https://example.com/game1.jpg",
        category: "VALID",
      },
      {
        id: 2,
        source: OfferSource.STEAM,
        type: OfferType.GAME,
        duration: OfferDuration.CLAIMABLE,
        title: "Existing Game 2",
        probable_game_name: "Existing Game 2",
        seen_first: twoDaysAgo.toISOString(),
        seen_last: yesterday.toISOString(),
        valid_from: twoDaysAgo.toISOString(),
        valid_to: tomorrow.toISOString(),
        rawtext: JSON.stringify({ title: "Existing Game 2" }),
        url: "https://example.com/game2",
        img_url: "https://example.com/game2.jpg",
        category: "VALID",
      },
      {
        id: 3,
        source: OfferSource.EPIC,
        type: OfferType.GAME,
        duration: OfferDuration.CLAIMABLE,
        title: "Demo Game",
        probable_game_name: "Demo Game",
        seen_first: yesterday.toISOString(),
        seen_last: yesterday.toISOString(),
        valid_from: yesterday.toISOString(),
        valid_to: tomorrow.toISOString(),
        rawtext: JSON.stringify({ title: "Demo Title" }),
        url: "https://example.com/demo",
        img_url: "https://example.com/demo.jpg",
        category: "DEMO",
      },
    ])
    .execute();

  // Insert steam_info
  await db
    .insertInto("steam_info")
    .values([
      {
        id: 723,
        name: "Existing Game 1",
        url: "https://store.steampowered.com/app/1",
        image_url: "https://cdn.steam.com/1.jpg",
        release_date: now.toISOString(),
      },
    ])
    .execute();

  // Insert igdb_info
  await db
    .insertInto("igdb_info")
    .values([
      {
        id: 589,
        name: "Existing Game 1",
        url: "https://igdb.com/games/1",
        release_date: now.toISOString(),
      },
    ])
    .execute();

  // Insert games
  await db
    .insertInto("games")
    .values([
      {
        id: 1,
        steam_id: 723,
        igdb_id: 589,
      },
    ])
    .execute();
}

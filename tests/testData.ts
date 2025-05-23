import {
  OfferDuration,
  OfferPlatform,
  OfferSource,
  OfferType,
} from "@/types/basic";
import type { Database } from "@/types/database";
import type { Kysely } from "kysely";
import { DateTime } from "luxon";

export async function insertTestData(db: Kysely<Database>) {
  const twoDaysAgo = DateTime.now().minus({ days: 2 });
  const yesterday = DateTime.now().minus({ days: 1 });
  const now = DateTime.now();
  const tomorrow = DateTime.now().plus({ days: 1 });

  // Insert announcements
  await db
    .insertInto("announcements")
    .values([
      {
        id: 1,
        channel: "TELEGRAM",
        date: twoDaysAgo.toISO(),
        text_markdown: "Test announcement 1 (from yesterday)",
      },
      {
        id: 2,
        channel: "TELEGRAM",
        date: yesterday.toISO(),
        text_markdown: "Test announcement 1 (from yesterday)",
      },
      {
        id: 3,
        channel: "TELEGRAM",
        date: now.toISO(),
        text_markdown: "Test announcement 1 (from now)",
      },
      {
        id: 4,
        channel: "TELEGRAM",
        date: tomorrow.toISO(),
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
        platform: OfferPlatform.PC,
        title: "Existing Game 1",
        probable_game_name: "Existing Game 1",
        seen_first: yesterday.toISO(),
        seen_last: now.toISO(),
        valid_from: yesterday.toISO(),
        valid_to: tomorrow.toISO(),
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
        platform: OfferPlatform.PC,
        title: "Existing Game 2",
        probable_game_name: "Existing Game 2",
        seen_first: twoDaysAgo.toISO(),
        seen_last: now.toISO(),
        valid_from: twoDaysAgo.toISO(),
        valid_to: tomorrow.toISO(),
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
        platform: OfferPlatform.PC,
        title: "Existing Game 3",
        probable_game_name: "Existing Game 3",
        seen_first: yesterday.toISO(),
        seen_last: now.toISO(),
        valid_from: yesterday.toISO(),
        valid_to: tomorrow.toISO(),
        rawtext: JSON.stringify({ title: "Demo Title" }),
        url: "https://example.com/demo",
        img_url: "https://example.com/demo.jpg",
        category: "DEMO",
      },
      // Not currently active
      {
        id: 4,
        source: OfferSource.EPIC,
        type: OfferType.GAME,
        duration: OfferDuration.CLAIMABLE,
        platform: OfferPlatform.PC,
        title: "Existing Game 4",
        probable_game_name: "Existing Game 4",
        seen_first: yesterday.toISO(),
        seen_last: now.toISO(),
        valid_from: yesterday.toISO(),
        valid_to: yesterday.toISO(),
        rawtext: JSON.stringify({ title: "Demo Title" }),
        url: "https://example.com/demo",
        img_url: "https://example.com/demo.jpg",
        category: "DEMO",
      },
      // Not currently active V2
      {
        id: 5,
        source: OfferSource.EPIC,
        type: OfferType.GAME,
        duration: OfferDuration.CLAIMABLE,
        platform: OfferPlatform.PC,
        title: "Existing Game 5",
        probable_game_name: "Existing Game 5",
        seen_first: twoDaysAgo.toISO(),
        seen_last: twoDaysAgo.toISO(),
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
        release_date: now.toISO(),
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
        release_date: now.toISO(),
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

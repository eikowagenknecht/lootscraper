// import type { OfferDuration, OfferSource, OfferType } from "@/types/config";
import type { Database, NewAnnouncement } from "@/types/database";
import { DatabaseError } from "@/types/errors";
// import { type Kysely, sql } from "kysely";
import type { Kysely } from "kysely";

export class DatabaseOperations {
  constructor(private db: Kysely<Database>) {}

  // Announcement operations
  async createAnnouncement(announcement: NewAnnouncement) {
    try {
      return await this.db
        .insertInto("announcements")
        .values({
          ...announcement,
          // date: sql`datetime(${announcement.date})`,
        })
        .executeTakeFirstOrThrow();
    } catch (error) {
      throw new DatabaseError(
        `Failed to create announcement: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getNewAnnouncements(lastAnnouncementId: number) {
    try {
      return await this.db
        .selectFrom("announcements")
        .where("id", ">", lastAnnouncementId)
        .selectAll()
        .orderBy("id", "asc")
        .execute();
    } catch (error) {
      throw new DatabaseError(
        `Failed to get new announcements: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // // Steam info operations
  // async upsertSteamInfo(
  //   steamInfo: Omit<Database["steam_info"], "id"> & { id: number },
  // ) {
  //   try {
  //     await this.db
  //       .insertInto("steam_info")
  //       .values({
  //         ...steamInfo,
  //         release_date: steamInfo.release_date
  //           ? sql`datetime(${steamInfo.release_date})`
  //           : null,
  //       })
  //       .onConflict((oc) =>
  //         oc.column("id").doUpdateSet({
  //           ...steamInfo,
  //           release_date: steamInfo.release_date
  //             ? sql`datetime(${steamInfo.release_date})`
  //             : null,
  //         }),
  //       )
  //       .execute();
  //   } catch (error) {
  //     throw new DatabaseError(
  //       `Failed to upsert Steam info: ${error instanceof Error ? error.message : String(error)}`,
  //     );
  //   }
  // }

  // // IGDB info operations
  // async upsertIgdbInfo(
  //   igdbInfo: Omit<Database["igdb_info"], "id"> & { id: number },
  // ) {
  //   try {
  //     await this.db
  //       .insertInto("igdb_info")
  //       .values({
  //         ...igdbInfo,
  //         release_date: igdbInfo.release_date
  //           ? sql`datetime(${igdbInfo.release_date})`
  //           : null,
  //       })
  //       .onConflict((oc) =>
  //         oc.column("id").doUpdateSet({
  //           ...igdbInfo,
  //           release_date: igdbInfo.release_date
  //             ? sql`datetime(${igdbInfo.release_date})`
  //             : null,
  //         }),
  //       )
  //       .execute();
  //   } catch (error) {
  //     throw new DatabaseError(
  //       `Failed to upsert IGDB info: ${error instanceof Error ? error.message : String(error)}`,
  //     );
  //   }
  // }

  // // Game operations
  // async findOrCreateGame(game: NewGame) {
  //   if (!game.steam_id && !game.igdb_id) {
  //     throw new DatabaseError("Game must have either Steam ID or IGDB ID");
  //   }

  //   try {
  //     // Check if game exists
  //     const existingGame = await this.db
  //       .selectFrom("games")
  //       .selectAll()
  //       .where((eb) =>
  //         eb.or([
  //           game.steam_id
  //             ? eb("steam_id", "=", game.steam_id)
  //             : eb("steam_id", "is", null),
  //           game.igdb_id
  //             ? eb("igdb_id", "=", game.igdb_id)
  //             : eb("igdb_id", "is", null),
  //         ]),
  //       )
  //       .executeTakeFirst();

  //     if (existingGame) {
  //       return existingGame;
  //     }

  //     // Create new game
  //     const newGame = await this.db
  //       .insertInto("games")
  //       .values({
  //         steam_id: game.steam_id ?? null,
  //         igdb_id: game.igdb_id ?? null,
  //       })
  //       .executeTakeFirstOrThrow();

  //     return newGame;
  //   } catch (error) {
  //     throw new DatabaseError(
  //       `Failed to find or create game: ${error instanceof Error ? error.message : String(error)}`,
  //     );
  //   }
  // }

  // // Offer operations
  // async findOfferByTitle(
  //   source: OfferSource,
  //   type: OfferType,
  //   duration: OfferDuration,
  //   title: string,
  //   validTo: Date | null,
  // ) {
  //   try {
  //     const query = this.db
  //       .selectFrom("offers")
  //       .selectAll()
  //       .where("source", "=", source)
  //       .where("type", "=", type)
  //       .where("duration", "=", duration)
  //       .where("title", "=", title);

  //     if (validTo) {
  //       const dayInMs = 24 * 60 * 60 * 1000;
  //       const earliest = new Date(validTo.getTime() - dayInMs);
  //       const latest = new Date(validTo.getTime() + dayInMs);

  //       query.where("valid_to", ">=", earliest).where("valid_to", "<=", latest);
  //     }

  //     return await query.executeTakeFirst();
  //   } catch (error) {
  //     throw new DatabaseError(
  //       `Failed to find offer: ${error instanceof Error ? error.message : String(error)}`,
  //     );
  //   }
  // }

  // async getActiveOffers(options: {
  //   type?: OfferType;
  //   source?: OfferSource;
  //   duration?: OfferDuration;
  //   lastOfferId?: number;
  //   now?: Date;
  // }) {
  //   const { type, source, duration, lastOfferId, now = new Date() } = options;

  //   try {
  //     let query = this.db
  //       .selectFrom("offers")
  //       .selectAll()
  //       .where((eb) =>
  //         eb.or([eb("valid_from", "is", null), eb("valid_from", "<=", now)]),
  //       )
  //       .where((eb) =>
  //         eb.or([
  //           eb("valid_to", "is", null),
  //           eb("valid_to", ">=", now),
  //           eb.and([
  //             eb("valid_to", "is", null),
  //             eb(
  //               "seen_last",
  //               ">=",
  //               new Date(now.getTime() - 24 * 60 * 60 * 1000),
  //             ),
  //           ]),
  //         ]),
  //       );

  //     if (type) {
  //       query = query.where("type", "=", type);
  //     }
  //     if (source) {
  //       query = query.where("source", "=", source);
  //     }
  //     if (duration) {
  //       query = query.where("duration", "=", duration);
  //     }
  //     if (lastOfferId) {
  //       query = query.where("id", ">", lastOfferId);
  //     }

  //     return await query.execute();
  //   } catch (error) {
  //     throw new DatabaseError(
  //       `Failed to get active offers: ${error instanceof Error ? error.message : String(error)}`,
  //     );
  //   }
  // }

  // // Telegram operations
  // async findTelegramChat(chatId: number, threadId?: number | null) {
  //   try {
  //     return await this.db
  //       .selectFrom("telegram_chats")
  //       .selectAll()
  //       .where("chat_id", "=", chatId)
  //       .where("thread_id", threadId ? "=" : "is", threadId ?? null)
  //       .executeTakeFirst();
  //   } catch (error) {
  //     throw new DatabaseError(
  //       `Failed to find telegram chat: ${error instanceof Error ? error.message : String(error)}`,
  //     );
  //   }
  // }

  // async updateTelegramChatActivity(
  //   chatId: number,
  //   active: boolean,
  //   reason?: string,
  // ) {
  //   try {
  //     await this.db
  //       .updateTable("telegram_chats")
  //       .set({
  //         active: active ? 1 : 0,
  //         inactive_reason: reason ?? null,
  //       })
  //       .where("chat_id", "=", chatId)
  //       .execute();
  //   } catch (error) {
  //     throw new DatabaseError(
  //       `Failed to update telegram chat activity: ${error instanceof Error ? error.message : String(error)}`,
  //     );
  //   }
  // }

  // // Telegram subscription operations
  // async toggleTelegramSubscription(
  //   chatId: number,
  //   source: OfferSource,
  //   type: OfferType,
  //   duration: OfferDuration,
  // ) {
  //   try {
  //     // Check if subscription exists
  //     const existingSub = await this.db
  //       .selectFrom("telegram_subscriptions")
  //       .selectAll()
  //       .where("chat_id", "=", chatId)
  //       .where("source", "=", source)
  //       .where("type", "=", type)
  //       .where("duration", "=", duration)
  //       .executeTakeFirst();

  //     if (existingSub) {
  //       // Delete subscription
  //       await this.db
  //         .deleteFrom("telegram_subscriptions")
  //         .where("id", "=", existingSub.id)
  //         .execute();
  //       return false; // Indicates unsubscribed
  //     }

  //     // Create subscription
  //     await this.db
  //       .insertInto("telegram_subscriptions")
  //       .values({
  //         chat_id: chatId,
  //         source,
  //         type,
  //         duration,
  //         last_offer_id: 0,
  //       })
  //       .execute();
  //     return true; // Indicates subscribed
  //   } catch (error) {
  //     throw new DatabaseError(
  //       `Failed to toggle subscription: ${error instanceof Error ? error.message : String(error)}`,
  //     );
  //   }
  // }
}

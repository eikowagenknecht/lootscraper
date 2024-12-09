import type {
  Database,
  Game,
  IgdbInfo,
  NewAnnouncement,
  NewGame,
  NewIgdbInfo,
  NewOffer,
  NewSteamInfo,
  Offer,
  OfferUpdate,
  SteamInfo,
} from "@/types/database";
import { DatabaseError } from "@/types/errors";
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

  // Offer operations
  private async createOffer(offer: NewOffer) {
    try {
      return await this.db
        .insertInto("offers")
        .values(offer)
        .executeTakeFirstOrThrow();
    } catch (error) {
      throw new DatabaseError(
        `Failed to create offer: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getOfferByTitle(title: string): Promise<Offer | undefined> {
    try {
      return await this.db
        .selectFrom("offers")
        .where("title", "=", title)
        .selectAll()
        .executeTakeFirst();
    } catch (error) {
      throw new DatabaseError(
        `Failed to get offer by title: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async updateOffer(id: number, offer: OfferUpdate) {
    try {
      const result = await this.db
        .updateTable("offers")
        .set(offer)
        .where("id", "=", id)
        .executeTakeFirst();

      if (!result.numUpdatedRows) {
        throw new DatabaseError(`No offer found with ID ${id.toFixed(0)}`);
      }

      return result;
    } catch (error) {
      throw new DatabaseError(
        `Failed to update offer: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async createOrUpdateOffer(offer: NewOffer): Promise<number> {
    try {
      // Find existing offer by unique combination
      const existingOffer = await this.db
        .selectFrom("offers")
        .select(["id"])
        .where("title", "=", offer.title)
        .where("source", "=", offer.source)
        .where("type", "=", offer.type)
        .where("duration", "=", offer.duration)
        .where("category", "=", offer.category)
        .executeTakeFirst();

      if (existingOffer) {
        // Update seen last date
        const result = await this.db
          .updateTable("offers")
          .set({
            seen_last: new Date().toISOString(),
          })
          .where("id", "=", existingOffer.id)
          .executeTakeFirst();

        if (!result.numUpdatedRows) {
          throw new DatabaseError("Failed to update existing offer");
        }

        return existingOffer.id;
      }

      const result = await this.createOffer(offer);

      const insertId = result.insertId;

      if (typeof insertId !== "bigint") {
        throw new DatabaseError("Failed to get inserted offer ID");
      }

      return Number(insertId);
    } catch (error) {
      throw new DatabaseError(
        `Failed to create or update offer: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // SteamInfo operations
  async createSteamInfo(info: NewSteamInfo): Promise<number> {
    try {
      const result = await this.db
        .insertInto("steam_info")
        .values(info)
        .executeTakeFirstOrThrow();
      const insertId = result.insertId;

      if (typeof insertId !== "bigint") {
        throw new DatabaseError("Failed to get inserted Steam info ID");
      }

      return Number(insertId);
    } catch (error) {
      throw new DatabaseError(
        `Failed to create Steam info: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // IgdbInfo operations
  async createIgdbInfo(info: NewIgdbInfo): Promise<number> {
    try {
      const result = await this.db
        .insertInto("igdb_info")
        .values(info)
        .executeTakeFirstOrThrow();
      const insertId = result.insertId;

      if (typeof insertId !== "bigint") {
        throw new DatabaseError("Failed to get inserted IGDB info ID");
      }

      return Number(insertId);
    } catch (error) {
      throw new DatabaseError(
        `Failed to create IGDB info: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Game operations
  async createGame(game: NewGame): Promise<number> {
    try {
      const result = await this.db
        .insertInto("games")
        .values(game)
        .executeTakeFirstOrThrow();
      const insertId = result.insertId;

      if (typeof insertId !== "bigint") {
        throw new DatabaseError("Failed to get inserted game ID");
      }

      return Number(insertId);
    } catch (error) {
      throw new DatabaseError(
        `Failed to create game: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async findGameBySteamName(name: string): Promise<Game | null> {
    try {
      return (
        (await this.db
          .selectFrom("games")
          .innerJoin("steam_info", "games.steam_id", "steam_info.id")
          .where("steam_info.name", "=", name)
          .selectAll("games")
          .executeTakeFirst()) ?? null
      );
    } catch (error) {
      throw new DatabaseError(
        `Failed to find game by Steam name: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async findGameByIgdbName(name: string): Promise<Game | null> {
    try {
      return (
        (await this.db
          .selectFrom("games")
          .innerJoin("igdb_info", "games.igdb_id", "igdb_info.id")
          .where("igdb_info.name", "=", name)
          .selectAll("games")
          .executeTakeFirst()) ?? null
      );
    } catch (error) {
      throw new DatabaseError(
        `Failed to find game by IGDB name: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async updateGameSteamInfo(gameId: number, steamId: number): Promise<void> {
    try {
      await this.db
        .updateTable("games")
        .set({ steam_id: steamId })
        .where("id", "=", gameId)
        .execute();
    } catch (error) {
      throw new DatabaseError(
        `Failed to update game Steam info: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async updateGameIgdbInfo(gameId: number, igdbId: number): Promise<void> {
    try {
      await this.db
        .updateTable("games")
        .set({ igdb_id: igdbId })
        .where("id", "=", gameId)
        .execute();
    } catch (error) {
      throw new DatabaseError(
        `Failed to update game IGDB info: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getGame(gameId: number): Promise<Game | null> {
    try {
      return (
        (await this.db
          .selectFrom("games")
          .where("id", "=", gameId)
          .selectAll()
          .executeTakeFirst()) ?? null
      );
    } catch (error) {
      throw new DatabaseError(
        `Failed to get game: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getGameWithInfo(gameId: number): Promise<{
    game: Game;
    steamInfo: SteamInfo | null;
    igdbInfo: IgdbInfo | null;
  } | null> {
    try {
      const game = await this.db
        .selectFrom("games")
        .where("id", "=", gameId)
        .selectAll()
        .executeTakeFirst();

      if (!game) return null;

      const [steamInfo, igdbInfo] = await Promise.all([
        game.steam_id
          ? this.db
              .selectFrom("steam_info")
              .where("id", "=", game.steam_id)
              .selectAll()
              .executeTakeFirstOrThrow()
          : null,
        game.igdb_id
          ? this.db
              .selectFrom("igdb_info")
              .where("id", "=", game.igdb_id)
              .selectAll()
              .executeTakeFirstOrThrow()
          : null,
      ]);

      return { game, steamInfo, igdbInfo };
    } catch (error) {
      throw new DatabaseError(
        `Failed to get game with info: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

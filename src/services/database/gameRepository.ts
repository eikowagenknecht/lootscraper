import type { Game, IgdbInfo, NewGame, SteamInfo } from "@/types/database";
import { BaseRepository } from "./baseRepository";

export class GameRepository extends BaseRepository {
  async create(game: NewGame): Promise<number> {
    try {
      const result = await this.db
        .insertInto("games")
        .values(game)
        .executeTakeFirstOrThrow();
      return this.handleInsertResult(result);
    } catch (error) {
      this.handleError("create game", error);
    }
  }

  async findBySteamName(name: string): Promise<Game | null> {
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
      this.handleError("find game by Steam name", error);
    }
  }

  async findByIgdbName(name: string): Promise<Game | null> {
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
      this.handleError("find game by IGDB name", error);
    }
  }

  async updateSteamInfo(gameId: number, steamId: number): Promise<void> {
    try {
      await this.db
        .updateTable("games")
        .set({ steam_id: steamId })
        .where("id", "=", gameId)
        .execute();
    } catch (error) {
      this.handleError("update game Steam info", error);
    }
  }

  async updateIgdbInfo(gameId: number, igdbId: number): Promise<void> {
    try {
      await this.db
        .updateTable("games")
        .set({ igdb_id: igdbId })
        .where("id", "=", gameId)
        .execute();
    } catch (error) {
      this.handleError("update game IGDB info", error);
    }
  }

  async getById(gameId: number): Promise<Game | null> {
    try {
      return (
        (await this.db
          .selectFrom("games")
          .where("id", "=", gameId)
          .selectAll()
          .executeTakeFirst()) ?? null
      );
    } catch (error) {
      this.handleError("get game", error);
    }
  }

  async getWithInfo(gameId: number): Promise<{
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
      this.handleError("get game with info", error);
    }
  }
}

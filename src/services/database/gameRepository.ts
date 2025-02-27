import { getDb } from "@/services/database";
import type { Game, IgdbInfo, NewGame, SteamInfo } from "@/types/database";
import { handleError, handleInsertResult } from "./common";
import { getIgdbInfoById } from "./igdbInfoRepository";
import { getSteamInfoById } from "./steamInfoRepository";

export async function getGameById(gameId: number): Promise<Game | null> {
  try {
    return (
      (await getDb()
        .selectFrom("games")
        .where("id", "=", gameId)
        .selectAll()
        .executeTakeFirst()) ?? null
    );
  } catch (error) {
    handleError("get game", error);
  }
}

export async function getGameWithInfo(gameId: number): Promise<{
  game: Game;
  steamInfo: SteamInfo | null;
  igdbInfo: IgdbInfo | null;
} | null> {
  try {
    const game = await getDb()
      .selectFrom("games")
      .where("id", "=", gameId)
      .selectAll()
      .executeTakeFirst();

    if (!game) return null;

    let steamInfo: SteamInfo | null = null;
    let igdbInfo: IgdbInfo | null = null;

    if (game.steam_id) {
      steamInfo = await getSteamInfoById(game.steam_id);
    }

    if (game.igdb_id) {
      igdbInfo = await getIgdbInfoById(game.igdb_id);
    }

    return { game, steamInfo, igdbInfo };
  } catch (error) {
    handleError("get game with info", error);
  }
}

export async function getGameBySteamName(name: string): Promise<Game | null> {
  try {
    return (
      (await getDb()
        .selectFrom("games")
        .innerJoin("steam_info", "games.steam_id", "steam_info.id")
        .where("steam_info.name", "=", name)
        .selectAll("games")
        .executeTakeFirst()) ?? null
    );
  } catch (error) {
    handleError("find game by Steam name", error);
  }
}

export async function getGameByIgdbName(name: string): Promise<Game | null> {
  try {
    return (
      (await getDb()
        .selectFrom("games")
        .innerJoin("igdb_info", "games.igdb_id", "igdb_info.id")
        .where("igdb_info.name", "=", name)
        .selectAll("games")
        .executeTakeFirst()) ?? null
    );
  } catch (error) {
    handleError("find game by IGDB name", error);
  }
}

export async function createGame(game: NewGame): Promise<number> {
  try {
    const result = await getDb()
      .insertInto("games")
      .values(game)
      .executeTakeFirstOrThrow();
    return handleInsertResult(result);
  } catch (error) {
    handleError("create game", error);
  }
}

export async function updateGameSteamInfo(
  gameId: number,
  steamId: number,
): Promise<void> {
  try {
    await getDb()
      .updateTable("games")
      .set({ steam_id: steamId })
      .where("id", "=", gameId)
      .execute();
  } catch (error) {
    handleError("update game Steam info", error);
  }
}

export async function updateGameIgdbInfo(
  gameId: number,
  igdbId: number,
): Promise<void> {
  try {
    await getDb()
      .updateTable("games")
      .set({ igdb_id: igdbId })
      .where("id", "=", gameId)
      .execute();
  } catch (error) {
    handleError("update game IGDB info", error);
  }
}

import { config } from "@/services/config";
import { DatabaseService } from "@/services/database";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { insertTestData } from "../../../tests/testData";
import {
  createGame,
  findGameByIgdbName,
  findGameBySteamName,
  getGameById,
  getGameWithInfo,
  updateGameIgdbInfo,
  updateGameSteamInfo,
} from "./gameRepository";
import { createIgdbInfo } from "./igdbInfoRepository";
import { createSteamInfo } from "./steamInfoRepository";

describe("Game Repository", () => {
  let dbService: DatabaseService;

  beforeEach(async () => {
    config.loadConfig();
    dbService = DatabaseService.getInstance();
    await dbService.initialize(config.get(), true);
    await insertTestData(dbService.get());
  });

  afterEach(async () => {
    await dbService.destroy();
  });

  describe("Game Operations", () => {
    let steamInfoId: number;
    let igdbInfoId: number;
    let gameId: number;

    beforeEach(async () => {
      // Create test data with minimal required fields
      steamInfoId = await createSteamInfo({
        name: "Test Game Steam",
        url: "https://store.steampowered.com/app/123",
        image_url: "https://cdn.steam.com/image.jpg",
        release_date: new Date().toISOString(),
        recommendations: null,
        percent: null,
        score: null,
        metacritic_score: null,
        metacritic_url: null,
        genres: null,
        short_description: null,
        recommended_price_eur: null,
        id: 123,
      });

      igdbInfoId = await createIgdbInfo({
        name: "Test Game IGDB",
        url: "https://igdb.com/games/test",
        release_date: new Date().toISOString(),
        meta_score: null,
        meta_ratings: null,
        user_score: null,
        user_ratings: null,
        short_description: null,
        id: 234,
      });

      gameId = await createGame({
        steam_id: steamInfoId,
        igdb_id: null,
      });
    });

    test("should create game", async () => {
      const newGameId = await createGame({
        steam_id: steamInfoId,
        igdb_id: igdbInfoId,
      });

      expect(newGameId).toBeGreaterThan(0);
    });

    test("should find game by steam name", async () => {
      const game = await findGameBySteamName("Test Game Steam");
      expect(game).not.toBeNull();
      expect(game?.steam_id).toBe(steamInfoId);
    });

    test("should find game by igdb name", async () => {
      // First update the game with IGDB info
      await updateGameIgdbInfo(gameId, igdbInfoId);

      const game = await findGameByIgdbName("Test Game IGDB");
      expect(game).not.toBeNull();
      expect(game?.igdb_id).toBe(igdbInfoId);
    });

    test("should update game steam info", async () => {
      const newSteamInfoId = await createSteamInfo({
        name: "Updated Steam Game",
        url: "https://store.steampowered.com/app/456",
        image_url: "https://cdn.steam.com/updated.jpg",
        release_date: new Date().toISOString(),
        id: 333,
      });

      await updateGameSteamInfo(gameId, newSteamInfoId);

      const updatedGame = await getGameById(gameId);
      expect(updatedGame?.steam_id).toBe(newSteamInfoId);
    });

    test("should update game igdb info", async () => {
      const newIgdbInfoId = await createIgdbInfo({
        name: "Updated IGDB Game",
        url: "https://igdb.com/games/updated",
        release_date: new Date().toISOString(),
        id: 444,
      });

      await updateGameIgdbInfo(gameId, newIgdbInfoId);

      const updatedGame = await getGameById(gameId);
      expect(updatedGame?.igdb_id).toBe(newIgdbInfoId);
    });

    test("should get game with full info", async () => {
      // Update game with both Steam and IGDB info
      await updateGameIgdbInfo(gameId, igdbInfoId);

      const gameWithInfo = await getGameWithInfo(gameId);

      expect(gameWithInfo).toBeDefined();
      expect(gameWithInfo?.game.id).toBe(gameId);
      expect(gameWithInfo?.steamInfo?.name).toBe("Test Game Steam");
      expect(gameWithInfo?.igdbInfo?.name).toBe("Test Game IGDB");
    });

    test("should handle non-existent game", async () => {
      const gameWithInfo = await getGameWithInfo(999);
      expect(gameWithInfo).toBeNull();
    });
  });
});

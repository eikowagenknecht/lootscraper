import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { config } from "@/services/config";
import { DatabaseService } from "@/services/database";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { insertTestData } from "../../../tests/database/testData";
import { GameRepository } from "./gameRepository";
import { IgdbInfoRepository } from "./igdbInfoRepository";
import { SteamInfoRepository } from "./steamInfoRepository";

describe("Announcement Repository", () => {
  const testDbPath = join(process.cwd(), "data", "test.db");

  let gameRepo: GameRepository;
  let steamInfoRepo: SteamInfoRepository;
  let igdbInfoRepo: IgdbInfoRepository;
  let dbService: DatabaseService;

  beforeEach(async () => {
    // Load the configuration
    config.loadConfig();
    const testConfig = config.get();
    testConfig.common.databaseFile = "test.db";

    // Create a new database service
    dbService = DatabaseService.getInstance();
    await dbService.initialize(testConfig);
    gameRepo = new GameRepository(dbService.get());
    steamInfoRepo = new SteamInfoRepository(dbService.get());
    igdbInfoRepo = new IgdbInfoRepository(dbService.get());

    // Insert test data
    await insertTestData(dbService.get());
  });

  afterEach(async () => {
    // Destroy the database service and remove the file
    await dbService.destroy();
    try {
      unlinkSync(testDbPath);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  describe("Game Operations", () => {
    let steamInfoId: number;
    let igdbInfoId: number;
    let gameId: number;

    beforeEach(async () => {
      // Create test data with minimal required fields
      steamInfoId = await steamInfoRepo.create({
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

      igdbInfoId = await igdbInfoRepo.create({
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

      gameId = await gameRepo.create({
        steam_id: steamInfoId,
        igdb_id: null,
      });
    });

    it("should create game", async () => {
      const newGameId = await gameRepo.create({
        steam_id: steamInfoId,
        igdb_id: igdbInfoId,
      });

      expect(newGameId).toBeGreaterThan(0);
    });

    it("should find game by steam name", async () => {
      const game = await gameRepo.findBySteamName("Test Game Steam");
      expect(game).not.toBeNull();
      expect(game?.steam_id).toBe(steamInfoId);
    });

    it("should find game by igdb name", async () => {
      // First update the game with IGDB info
      await gameRepo.updateIgdbInfo(gameId, igdbInfoId);

      const game = await gameRepo.findByIgdbName("Test Game IGDB");
      expect(game).not.toBeNull();
      expect(game?.igdb_id).toBe(igdbInfoId);
    });

    it("should update game steam info", async () => {
      const newSteamInfoId = await steamInfoRepo.create({
        name: "Updated Steam Game",
        url: "https://store.steampowered.com/app/456",
        image_url: "https://cdn.steam.com/updated.jpg",
        release_date: new Date().toISOString(),
        id: 333,
      });

      await gameRepo.updateSteamInfo(gameId, newSteamInfoId);

      const updatedGame = await gameRepo.getById(gameId);
      expect(updatedGame?.steam_id).toBe(newSteamInfoId);
    });

    it("should update game igdb info", async () => {
      const newIgdbInfoId = await igdbInfoRepo.create({
        name: "Updated IGDB Game",
        url: "https://igdb.com/games/updated",
        release_date: new Date().toISOString(),
        id: 444,
      });

      await gameRepo.updateIgdbInfo(gameId, newIgdbInfoId);

      const updatedGame = await gameRepo.getById(gameId);
      expect(updatedGame?.igdb_id).toBe(newIgdbInfoId);
    });

    it("should get game with full info", async () => {
      // Update game with both Steam and IGDB info
      await gameRepo.updateIgdbInfo(gameId, igdbInfoId);

      const gameWithInfo = await gameRepo.getWithInfo(gameId);

      expect(gameWithInfo).toBeDefined();
      expect(gameWithInfo?.game.id).toBe(gameId);
      expect(gameWithInfo?.steamInfo?.name).toBe("Test Game Steam");
      expect(gameWithInfo?.igdbInfo?.name).toBe("Test Game IGDB");
    });

    it("should handle non-existent game", async () => {
      const gameWithInfo = await gameRepo.getWithInfo(999);
      expect(gameWithInfo).toBeNull();
    });
  });
});

import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { config } from "@/services/config";
import { DatabaseService } from "@/services/database";
import { DatabaseOperations } from "@/services/database/operations";
import { OfferDuration, OfferSource, OfferType } from "@/types/config";
import type { NewOffer } from "@/types/database";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { insertTestData } from "../../../tests/database/testData";

describe("Database Operations", () => {
  const testDbPath = join(process.cwd(), "data", "test.db");
  let operations: DatabaseOperations;
  let dbService: DatabaseService;

  beforeEach(async () => {
    // Load the configuration
    config.loadConfig();
    const testConfig = config.get();
    testConfig.common.databaseFile = "test.db";

    // Create a new database service
    dbService = DatabaseService.getInstance();
    await dbService.initialize(testConfig);
    operations = new DatabaseOperations(dbService.get());

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

  describe("Announcement Operations", () => {
    it("should create announcement", async () => {
      const announcement = await operations.createAnnouncement({
        channel: "TELEGRAM",
        date: new Date().toISOString(),
        text_markdown: "Test announcement",
      });

      console.log(announcement);
      expect(announcement.insertId).toBe(5n);
      expect(announcement.numInsertedOrUpdatedRows).toBe(1n);
    });

    it("should get new announcements", async () => {
      const announcements = await operations.getNewAnnouncements(1);
      expect(announcements).toHaveLength(3);
      expect(announcements[0].id).toBe(2);
      expect(announcements[1].id).toBe(3);
      expect(announcements[2].id).toBe(4);
    });
  });

  describe("Offer Operations", () => {
    it("should create new offer", async () => {
      const newOffer: NewOffer = {
        source: OfferSource.EPIC,
        type: OfferType.GAME,
        duration: OfferDuration.CLAIMABLE,
        title: "New Game",
        probable_game_name: "New Game",
        seen_last: new Date().toISOString(),
        seen_first: new Date().toISOString(),
        rawtext: JSON.stringify({ title: "New Game" }),
        url: "https://example.com/new",
        img_url: "https://example.com/new.jpg",
        category: "VALID",
      };

      const offerId = await operations.createOrUpdateOffer(newOffer);
      expect(offerId).toBe(4); // Since we had 3 offers in test data

      const createdOffer = await operations.getOfferByTitle("New Game");
      expect(createdOffer).toBeDefined();
      expect(createdOffer?.title).toBe("New Game");
    });

    it("should update seen_last for existing offer", async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const existingOffer: NewOffer = {
        source: OfferSource.EPIC,
        type: OfferType.GAME,
        duration: OfferDuration.CLAIMABLE,
        title: "Existing Game 1",
        probable_game_name: "Existing Game 1",
        seen_last: yesterday.toISOString(),
        seen_first: yesterday.toISOString(),
        rawtext: JSON.stringify({ title: "Existing Game 1" }),
        url: "https://example.com/game1",
        img_url: "https://example.com/game1.jpg",
        category: "VALID",
      };

      const offerId = await operations.createOrUpdateOffer(existingOffer);
      expect(offerId).toBe(1); // Should be the same ID as the existing offer

      const updatedOffer = await operations.getOfferByTitle("Existing Game 1");
      expect(updatedOffer).toBeDefined();
      if (!updatedOffer) {
        return;
      }
      expect(new Date(updatedOffer.seen_last).getTime()).toBeGreaterThan(
        new Date(existingOffer.seen_last).getTime(),
      );
    });

    it("should handle duplicate offer with different source", async () => {
      const duplicateOffer: NewOffer = {
        source: OfferSource.GOG, // Different source
        type: OfferType.GAME,
        duration: OfferDuration.CLAIMABLE,
        title: "Existing Game 1",
        probable_game_name: "Existing Game 1",
        seen_last: new Date().toISOString(),
        seen_first: new Date().toISOString(),
        rawtext: JSON.stringify({ title: "Existing Game 1" }),
        url: "https://example.com/game1",
        img_url: "https://example.com/game1.jpg",
        category: "VALID",
      };

      const offerId = await operations.createOrUpdateOffer(duplicateOffer);
      expect(offerId).toBe(4); // Should be a new offer

      // Should find both offers
      const offers = await dbService
        .get()
        .selectFrom("offers")
        .where("title", "=", "Existing Game 1")
        .selectAll()
        .execute();

      expect(offers).toHaveLength(2);
      expect(offers.map((o) => o.source)).toContain(OfferSource.EPIC);
      expect(offers.map((o) => o.source)).toContain(OfferSource.GOG);
    });

    it("should get offer by title", async () => {
      const offer = await operations.getOfferByTitle("Existing Game 1");
      expect(offer).toBeDefined();
      expect(offer?.id).toBe(1);
      expect(offer?.source).toBe(OfferSource.EPIC);
    });

    it("should update offer", async () => {
      const updateData = {
        url: "https://example.com/updated",
        img_url: "https://example.com/updated.jpg",
      };

      await operations.updateOffer(1, updateData);

      const updatedOffer = await operations.getOfferByTitle("Existing Game 1");
      expect(updatedOffer).toBeDefined();
      expect(updatedOffer?.url).toBe("https://example.com/updated");
      expect(updatedOffer?.img_url).toBe("https://example.com/updated.jpg");
    });

    it("should handle non-existent offer updates", async () => {
      await expect(
        operations.updateOffer(999, { url: "https://example.com/nonexistent" }),
      ).rejects.toThrow();
    });
  });

  describe("Steam Info Operations", () => {
    it("should create steam info", async () => {
      const steamInfoId = await operations.createSteamInfo({
        name: "Test Game",
        url: "https://store.steampowered.com/app/123",
        image_url: "https://cdn.steam.com/image.jpg",
        release_date: new Date().toISOString(),
        metacritic_score: 85,
        metacritic_url: "https://metacritic.com/game/test",
        recommendations: 1000,
        percent: 90,
        score: 9,
        genres: "Action, Adventure",
        short_description: "A test game",
        recommended_price_eur: 29.99,
        id: 123,
      });

      expect(steamInfoId).toBe(123);
    });
  });

  describe("IGDB Info Operations", () => {
    it("should create igdb info", async () => {
      const igdbInfo = await operations.createIgdbInfo({
        name: "Test Game",
        url: "https://igdb.com/games/test",
        release_date: new Date().toISOString(),
        meta_score: 88,
        meta_ratings: 45,
        user_score: 92,
        user_ratings: 1500,
        short_description: "A fantastic test game",
        id: 234,
      });

      expect(igdbInfo).toBe(234);
    });
  });

  describe("Game Operations", () => {
    let steamInfoId: number;
    let igdbInfoId: number;
    let gameId: number;

    beforeEach(async () => {
      // Create test data with minimal required fields
      steamInfoId = await operations.createSteamInfo({
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

      igdbInfoId = await operations.createIgdbInfo({
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

      gameId = await operations.createGame({
        steam_id: steamInfoId,
        igdb_id: null,
      });
    });

    it("should create game", async () => {
      const newGameId = await operations.createGame({
        steam_id: steamInfoId,
        igdb_id: igdbInfoId,
      });

      expect(newGameId).toBeGreaterThan(0);
    });

    it("should find game by steam name", async () => {
      const game = await operations.findGameBySteamName("Test Game Steam");
      expect(game).not.toBeNull();
      expect(game?.steam_id).toBe(steamInfoId);
    });

    it("should find game by igdb name", async () => {
      // First update the game with IGDB info
      await operations.updateGameIgdbInfo(gameId, igdbInfoId);

      const game = await operations.findGameByIgdbName("Test Game IGDB");
      expect(game).not.toBeNull();
      expect(game?.igdb_id).toBe(igdbInfoId);
    });

    it("should update game steam info", async () => {
      const newSteamInfoId = await operations.createSteamInfo({
        name: "Updated Steam Game",
        url: "https://store.steampowered.com/app/456",
        image_url: "https://cdn.steam.com/updated.jpg",
        release_date: new Date().toISOString(),
        id: 333,
      });

      await operations.updateGameSteamInfo(gameId, newSteamInfoId);

      const updatedGame = await operations.getGame(gameId);
      expect(updatedGame?.steam_id).toBe(newSteamInfoId);
    });

    it("should update game igdb info", async () => {
      const newIgdbInfoId = await operations.createIgdbInfo({
        name: "Updated IGDB Game",
        url: "https://igdb.com/games/updated",
        release_date: new Date().toISOString(),
        id: 444,
      });

      await operations.updateGameIgdbInfo(gameId, newIgdbInfoId);

      const updatedGame = await operations.getGame(gameId);
      expect(updatedGame?.igdb_id).toBe(newIgdbInfoId);
    });

    it("should get game with full info", async () => {
      // Update game with both Steam and IGDB info
      await operations.updateGameIgdbInfo(gameId, igdbInfoId);

      const gameWithInfo = await operations.getGameWithInfo(gameId);

      expect(gameWithInfo).toBeDefined();
      expect(gameWithInfo?.game.id).toBe(gameId);
      expect(gameWithInfo?.steamInfo?.name).toBe("Test Game Steam");
      expect(gameWithInfo?.igdbInfo?.name).toBe("Test Game IGDB");
    });

    it("should handle non-existent game", async () => {
      const gameWithInfo = await operations.getGameWithInfo(999);
      expect(gameWithInfo).toBeNull();
    });
  });
});

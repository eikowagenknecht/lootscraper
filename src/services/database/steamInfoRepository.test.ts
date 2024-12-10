import { config } from "@/services/config";
import { DatabaseService } from "@/services/database";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { insertTestData } from "../../../tests/database/testData";
import { createSteamInfo } from "./steamInfoRepository";

describe("Announcement Repository", () => {
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

  describe("Steam Info Operations", () => {
    it("should create steam info", async () => {
      const steamInfoId = await createSteamInfo({
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
});

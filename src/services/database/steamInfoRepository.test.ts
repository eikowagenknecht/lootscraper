import { config } from "@/services/config";
import { DatabaseService } from "@/services/database";
import { DateTime } from "luxon";
import { insertTestData } from "tests/testData";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createSteamInfo } from "./steamInfoRepository";

describe("Steam Info Repository", () => {
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
    test("should create steam info", async () => {
      const steamInfoId = await createSteamInfo({
        name: "Test Game",
        url: "https://store.steampowered.com/app/123",
        image_url: "https://cdn.steam.com/image.jpg",
        release_date: DateTime.now().toISO(),
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

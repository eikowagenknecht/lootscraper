import { config } from "@/services/config";
import { DatabaseService } from "@/services/database";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { insertTestData } from "../../../tests/testData";
import { createIgdbInfo } from "./igdbInfoRepository";

describe("IGDB Info Repository", () => {
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

  describe("IGDB Info Operations", () => {
    test("should create igdb info", async () => {
      const igdbInfo = await createIgdbInfo({
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
});

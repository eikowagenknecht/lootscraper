import { DateTime } from "luxon";
import { insertTestData } from "tests/testData";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { config } from "@/services/config";
import { databaseService } from "@/services/database";

import { createIgdbInfo } from "./igdbInfoRepository";

describe("IGDB Info Repository", () => {
  beforeEach(async () => {
    config.loadConfig();
    await databaseService.initialize(config.get(), true);
    await insertTestData(databaseService.get());
  });

  afterEach(async () => {
    await databaseService.destroy();
  });

  describe("IGDB Info Operations", () => {
    test("should create igdb info", async () => {
      const igdbInfo = await createIgdbInfo({
        name: "Test Game",
        url: "https://igdb.com/games/test",
        release_date: DateTime.now().toISO(),
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

import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { config } from "@/services/config";
import { DatabaseService } from "@/services/database";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { insertTestData } from "../../../tests/database/testData";
import { createIgdbInfo } from "./igdbInfoRepository";

describe("Announcement Repository", () => {
  const testDbPath = join(process.cwd(), "data", "igdb_test.db");

  let dbService: DatabaseService;

  beforeEach(async () => {
    // Load the configuration
    config.loadConfig();
    const testConfig = config.get();
    testConfig.common.databaseFile = "igdb_test.db";

    // Create a new database service
    dbService = DatabaseService.getInstance();
    await dbService.initialize(testConfig);

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

  describe("IGDB Info Operations", () => {
    it("should create igdb info", async () => {
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

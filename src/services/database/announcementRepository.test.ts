import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { config } from "@/services/config";
import { DatabaseService } from "@/services/database";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { insertTestData } from "../../../tests/database/testData";
import {
  createAnnouncement,
  getNewAnnouncements,
} from "./announcementRepository";

describe("Announcement Repository", () => {
  const testDbPath = join(process.cwd(), "data", "announcement_test.db");

  let dbService: DatabaseService;

  beforeEach(async () => {
    // Load the configuration
    config.loadConfig();
    const testConfig = config.get();
    testConfig.common.databaseFile = "announcement_test.db";

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

  describe("Announcement Operations", () => {
    it("should create announcement", async () => {
      const announcement = await createAnnouncement({
        channel: "TELEGRAM",
        date: new Date().toISOString(),
        text_markdown: "Test announcement",
      });

      console.log(announcement);
      expect(announcement).toBe(5);
    });

    it("should get new announcements", async () => {
      const announcements = await getNewAnnouncements(1);
      expect(announcements).toHaveLength(3);
      expect(announcements[0].id).toBe(2);
      expect(announcements[1].id).toBe(3);
      expect(announcements[2].id).toBe(4);
    });
  });
});

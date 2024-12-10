import { config } from "@/services/config";
import { DatabaseService } from "@/services/database";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { insertTestData } from "../../../tests/testData";
import {
  createAnnouncement,
  getNewAnnouncements,
} from "./announcementRepository";

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

  describe("Announcement Operations", () => {
    test("should create announcement", async () => {
      const announcement = await createAnnouncement({
        channel: "TELEGRAM",
        date: new Date().toISOString(),
        text_markdown: "Test announcement",
      });

      console.log(announcement);
      expect(announcement).toBe(5);
    });

    test("should get new announcements", async () => {
      const announcements = await getNewAnnouncements(1);
      expect(announcements).toHaveLength(3);
      expect(announcements[0].id).toBe(2);
      expect(announcements[1].id).toBe(3);
      expect(announcements[2].id).toBe(4);
    });
  });
});

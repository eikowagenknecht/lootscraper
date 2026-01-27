import { DateTime } from "luxon";
import { insertTestData } from "tests/testData";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { config } from "@/services/config";
import { databaseService } from "@/services/database";

import { createAnnouncement, getNewAnnouncements } from "./announcementRepository";

describe("Announcement Repository", () => {
  beforeEach(async () => {
    config.loadConfig();
    await databaseService.initialize(config.get(), true);
    await insertTestData(databaseService.get());
  });

  afterEach(async () => {
    await databaseService.destroy();
  });

  describe("Announcement Operations", () => {
    test("should create announcement", async () => {
      const announcement = await createAnnouncement({
        channel: "TELEGRAM",
        date: DateTime.now().toISO(),
        text_markdown: "Test announcement",
      });
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

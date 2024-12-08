import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { config } from "@/services/config";
import { DatabaseService } from "@/services/database";
import { DatabaseOperations } from "@/services/database/operations";
// import { OfferDuration, OfferSource, OfferType } from "@/types/config";
import { afterEach, beforeEach, describe, expect, it } from "vitest"; // expect,
import { insertTestData } from "./testData";

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

  // describe("Offer Operations", () => {
  //   it("should find offer by title", async () => {
  //     const offer = await operations.findOfferByTitle(
  //       OfferSource.STEAM,
  //       OfferType.GAME,
  //       OfferDuration.CLAIMABLE,
  //       "Test Game",
  //       new Date(Date.now() + 24 * 60 * 60 * 1000),
  //     );

  //     expect(offer).toBeDefined();
  //     expect(offer?.title).toBe("Test Game");
  //   });

  //   it("should get active offers", async () => {
  //     const offers = await operations.getActiveOffers({
  //       source: OfferSource.STEAM,
  //       type: OfferType.GAME,
  //     });

  //     expect(offers).toHaveLength(1);
  //     expect(offers[0].title).toBe("Test Game");
  //   });
  // });

  // describe("Game Operations", () => {
  //   it("should find existing game", async () => {
  //     const game = await operations.findOrCreateGame(1, 1);
  //     expect(game.id).toBe(1);
  //   });

  //   it("should create new game", async () => {
  //     const game = await operations.findOrCreateGame(2, 2);
  //     expect(game.id).toBe(2);
  //   });
  // });

  // describe("Telegram Operations", () => {
  //   it("should find telegram chat", async () => {
  //     const chat = await operations.findTelegramChat(123456);
  //     expect(chat).toBeDefined();
  //     expect(chat?.active).toBe(1);
  //   });

  //   it("should update telegram chat activity", async () => {
  //     await operations.updateTelegramChatActivity(123456, false, "test_reason");
  //     const chat = await operations.findTelegramChat(123456);
  //     expect(chat?.active).toBe(0);
  //     expect(chat?.inactive_reason).toBe("test_reason");
  //   });

  //   it("should toggle telegram subscription", async () => {
  //     // Test subscribe
  //     const subscribed = await operations.toggleTelegramSubscription(
  //       1,
  //       OfferSource.EPIC,
  //       OfferType.GAME,
  //       OfferDuration.CLAIMABLE,
  //     );
  //     expect(subscribed).toBe(true);

  //     // Test unsubscribe
  //     const unsubscribed = await operations.toggleTelegramSubscription(
  //       1,
  //       OfferSource.STEAM,
  //       OfferType.GAME,
  //       OfferDuration.CLAIMABLE,
  //     );
  //     expect(unsubscribed).toBe(false);
  //   });
  // });
});

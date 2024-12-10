import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { config } from "@/services/config";
import { DatabaseService } from "@/services/database";
import { OfferDuration, OfferSource, OfferType } from "@/types/config";
import type { NewOffer } from "@/types/database";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { insertTestData } from "../../../tests/database/testData";
import { OfferRepository } from "./offerRepository";

describe("Announcement Repository", () => {
  const testDbPath = join(process.cwd(), "data", "test.db");

  let repo: OfferRepository;
  let dbService: DatabaseService;

  beforeEach(async () => {
    // Load the configuration
    config.loadConfig();
    const testConfig = config.get();
    testConfig.common.databaseFile = "test.db";

    // Create a new database service
    dbService = DatabaseService.getInstance();
    await dbService.initialize(testConfig);
    repo = new OfferRepository(dbService.get());

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

      const offerId = await repo.createOrUpdate(newOffer);
      expect(offerId).toBe(4); // Since we had 3 offers in test data

      const createdOffer = await repo.getByTitle("New Game");
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

      const offerId = await repo.createOrUpdate(existingOffer);
      expect(offerId).toBe(1); // Should be the same ID as the existing offer

      const updatedOffer = await repo.getByTitle("Existing Game 1");
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

      const offerId = await repo.createOrUpdate(duplicateOffer);
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
      const offer = await repo.getByTitle("Existing Game 1");
      expect(offer).toBeDefined();
      expect(offer?.id).toBe(1);
      expect(offer?.source).toBe(OfferSource.EPIC);
    });

    it("should update offer", async () => {
      const updateData = {
        url: "https://example.com/updated",
        img_url: "https://example.com/updated.jpg",
      };

      await repo.update(1, updateData);

      const updatedOffer = await repo.getByTitle("Existing Game 1");
      expect(updatedOffer).toBeDefined();
      expect(updatedOffer?.url).toBe("https://example.com/updated");
      expect(updatedOffer?.img_url).toBe("https://example.com/updated.jpg");
    });

    it("should handle non-existent offer updates", async () => {
      await expect(
        repo.update(999, { url: "https://example.com/nonexistent" }),
      ).rejects.toThrow();
    });
  });
});

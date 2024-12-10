import { config } from "@/services/config";
import { DatabaseService } from "@/services/database";
import { OfferDuration, OfferSource, OfferType } from "@/types/config";
import type { NewOffer } from "@/types/database";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { insertTestData } from "../../../tests/database/testData";
import {
  createOrUpdateOffer,
  getOfferByTitle,
  updateOffer,
} from "./offerRepository";

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

      const offerId = await createOrUpdateOffer(newOffer);
      expect(offerId).toBe(4); // Since we had 3 offers in test data

      const createdOffer = await getOfferByTitle("New Game");
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

      const offerId = await createOrUpdateOffer(existingOffer);
      expect(offerId).toBe(1); // Should be the same ID as the existing offer

      const updatedOffer = await getOfferByTitle("Existing Game 1");
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

      const offerId = await createOrUpdateOffer(duplicateOffer);
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
      const offer = await getOfferByTitle("Existing Game 1");
      expect(offer).toBeDefined();
      expect(offer?.id).toBe(1);
      expect(offer?.source).toBe(OfferSource.EPIC);
    });

    it("should update offer", async () => {
      const updateData = {
        url: "https://example.com/updated",
        img_url: "https://example.com/updated.jpg",
      };

      await updateOffer(1, updateData);

      const updatedOffer = await getOfferByTitle("Existing Game 1");
      expect(updatedOffer).toBeDefined();
      expect(updatedOffer?.url).toBe("https://example.com/updated");
      expect(updatedOffer?.img_url).toBe("https://example.com/updated.jpg");
    });

    it("should handle non-existent offer updates", async () => {
      await expect(
        updateOffer(999, { url: "https://example.com/nonexistent" }),
      ).rejects.toThrow();
    });
  });
});

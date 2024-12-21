import { config } from "@/services/config";
import { DatabaseService } from "@/services/database";
import { OfferDuration, OfferSource, OfferType } from "@/types/config";
import type { NewOffer } from "@/types/database";
import { DateTime } from "luxon";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { insertTestData } from "../../../tests/testData";
import {
  createOrUpdateOffer,
  getActiveOffers,
  getOfferByTitle,
  updateOffer,
} from "./offerRepository";

describe("Offer Repository", () => {
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

  describe("Active Offers", () => {
    test("should get all active offers", async () => {
      const activeOffers = await getActiveOffers(DateTime.now().toJSDate());
      expect(activeOffers).toBeDefined();
      expect(activeOffers).toHaveLength(3); // All test offers are active

      // Verify all returned offers are actually active
      for (const offer of activeOffers) {
        if (offer.valid_to) {
          expect(DateTime.fromISO(offer.valid_to).toMillis()).toBeGreaterThan(
            DateTime.now().toMillis(),
          );
        }
      }
    });

    test("should not include expired offers", async () => {
      // Add an expired offer
      const expiredOffer: NewOffer = {
        source: OfferSource.EPIC,
        type: OfferType.GAME,
        duration: OfferDuration.CLAIMABLE,
        title: "Expired Game",
        probable_game_name: "Expired Game",
        seen_last: DateTime.now().toISO(),
        seen_first: DateTime.now().toISO(),
        valid_to: DateTime.now().minus({ days: 2 }).toISO(),
        rawtext: JSON.stringify({ title: "Expired Game" }),
        url: "https://example.com/expired",
        img_url: "https://example.com/expired.jpg",
        category: "VALID",
      };

      await createOrUpdateOffer(expiredOffer);

      const activeOffers = await getActiveOffers(DateTime.now().toJSDate());
      const expiredOfferInList = activeOffers.find(
        (o) => o.title === "Expired Game",
      );
      expect(expiredOfferInList).toBeUndefined();
    });
  });

  describe("Offer Operations", () => {
    test("should create new offer", async () => {
      const newOffer: NewOffer = {
        source: OfferSource.EPIC,
        type: OfferType.GAME,
        duration: OfferDuration.CLAIMABLE,
        title: "New Game",
        probable_game_name: "New Game",
        seen_last: DateTime.now().toISO(),
        seen_first: DateTime.now().toISO(),
        rawtext: JSON.stringify({ title: "New Game" }),
        url: "https://example.com/new",
        img_url: "https://example.com/new.jpg",
        category: "VALID",
      };

      const res = await createOrUpdateOffer(newOffer);
      expect(res.id).toBe(4); // Since we had 3 offers in test data

      const createdOffer = await getOfferByTitle("New Game");
      expect(createdOffer).toBeDefined();
      expect(createdOffer?.title).toBe("New Game");
    });

    test("should update seen_last for existing offer", async () => {
      const yesterday = DateTime.now().minus({ days: 1 });

      const existingOffer: NewOffer = {
        source: OfferSource.EPIC,
        type: OfferType.GAME,
        duration: OfferDuration.CLAIMABLE,
        title: "Existing Game 1",
        probable_game_name: "Existing Game 1",
        seen_last: yesterday.toISO(),
        seen_first: yesterday.toISO(),
        rawtext: JSON.stringify({ title: "Existing Game 1" }),
        url: "https://example.com/game1",
        img_url: "https://example.com/game1.jpg",
        category: "VALID",
      };

      const res = await createOrUpdateOffer(existingOffer);
      expect(res.id).toBe(1); // Should be the same ID as the existing offer

      const updatedOffer = await getOfferByTitle("Existing Game 1");
      expect(updatedOffer).toBeDefined();
      if (!updatedOffer) {
        return;
      }
      expect(
        DateTime.fromISO(updatedOffer.seen_last).toMillis(),
      ).toBeGreaterThan(DateTime.fromISO(existingOffer.seen_last).toMillis());
    });

    test("should handle duplicate offer with different source", async () => {
      const duplicateOffer: NewOffer = {
        source: OfferSource.GOG, // Different source
        type: OfferType.GAME,
        duration: OfferDuration.CLAIMABLE,
        title: "Existing Game 1",
        probable_game_name: "Existing Game 1",
        seen_last: DateTime.now().toISO(),
        seen_first: DateTime.now().toISO(),
        rawtext: JSON.stringify({ title: "Existing Game 1" }),
        url: "https://example.com/game1",
        img_url: "https://example.com/game1.jpg",
        category: "VALID",
      };

      const res = await createOrUpdateOffer(duplicateOffer);
      expect(res.id).toBe(4); // Should be a new offer

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

    test("should get offer by title", async () => {
      const offer = await getOfferByTitle("Existing Game 1");
      expect(offer).toBeDefined();
      expect(offer?.id).toBe(1);
      expect(offer?.source).toBe(OfferSource.EPIC);
    });

    test("should update offer", async () => {
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

    test("should handle non-existent offer updates", async () => {
      await expect(
        updateOffer(999, { url: "https://example.com/nonexistent" }),
      ).rejects.toThrow();
    });
  });
});

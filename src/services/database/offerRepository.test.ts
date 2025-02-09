import { config } from "@/services/config";
import { databaseService } from "@/services/database";
import {
  OfferDuration,
  OfferPlatform,
  OfferSource,
  OfferType,
} from "@/types/basic";
import type { NewOffer } from "@/types/database";
import { DateTime } from "luxon";
import { insertTestData } from "tests/testData";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  createOffer,
  getActiveOffers,
  getOfferByTitle,
  updateOffer,
} from "./offerRepository";

describe("Offer Repository", () => {
  beforeEach(async () => {
    config.loadConfig();
    await databaseService.initialize(config.get(), true);
    await insertTestData(databaseService.get());
  });

  afterEach(async () => {
    await databaseService.destroy();
  });

  describe("Active Offers", () => {
    test("should get all active offers", async () => {
      const activeOffers = await getActiveOffers(DateTime.now());
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
        platform: OfferPlatform.PC,
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

      await createOffer(expiredOffer);

      const activeOffers = await getActiveOffers(DateTime.now());
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
        platform: OfferPlatform.PC,
        title: "New Game",
        probable_game_name: "New Game",
        seen_last: DateTime.now().toISO(),
        seen_first: DateTime.now().toISO(),
        rawtext: JSON.stringify({ title: "New Game" }),
        url: "https://example.com/new",
        img_url: "https://example.com/new.jpg",
        category: "VALID",
      };

      const res = await createOffer(newOffer);
      expect(res).toBe(6); // Since we had 5 offers in test data, the next created should get the id 6

      const createdOffer = await getOfferByTitle("New Game");
      expect(createdOffer).toBeDefined();
      expect(createdOffer?.title).toBe("New Game");
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

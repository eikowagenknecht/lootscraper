import {
  OfferDuration,
  type OfferSource,
  type OfferType,
} from "@/types/config";
import type { NewOffer, Offer, OfferUpdate } from "@/types/database";
import { calculateRealValidTo } from "@/utils";
import { logger } from "@/utils/logger";
import { DateTime } from "luxon";
import { getDb } from "../database";
import { handleError, handleInsertResult, handleUpdateResult } from "./common";

interface OfferFilters {
  type?: OfferType;
  source?: OfferSource;
  duration?: OfferDuration;
  lastOfferId?: number;
}

async function createOffer(offer: NewOffer): Promise<number> {
  try {
    const result = await getDb()
      .insertInto("offers")
      .values(offer)
      .executeTakeFirstOrThrow();
    return handleInsertResult(result);
  } catch (error) {
    handleError("create offer", error);
  }
}

export async function getOfferByTitle(
  title: string,
): Promise<Offer | undefined> {
  try {
    return await getDb()
      .selectFrom("offers")
      .where("title", "=", title)
      .selectAll()
      .executeTakeFirst();
  } catch (error) {
    handleError("get offer by title", error);
  }
}

export async function getActiveOffers(
  time: Date,
  filters?: OfferFilters,
): Promise<Offer[]> {
  try {
    const yesterday = DateTime.fromJSDate(time).minus({ days: 1 }).toJSDate();

    logger.debug(`Getting active offers for ${time.toISOString()}`);

    let query = getDb()
      .selectFrom("offers")
      .where((eb) =>
        eb.and([
          eb.or([
            // Definitely active offers
            eb("valid_from", "<=", time.toISOString()),
            // Unknown valid_from
            eb("valid_from", "is", null),
          ]),
          eb.or([
            eb.or([
              // Definitely active offers
              eb("valid_to", ">=", time.toISOString()),
              // Unknown valid_to
              eb("valid_to", "is", null),
            ]),
            // Seen in last 24 hours for offers where we don't know when they
            // will end
            eb.and([
              eb("valid_to", "is", null),
              eb("seen_last", "is not", null),
              eb("seen_last", ">=", yesterday.toISOString()),
            ]),
          ]),
        ]),
      );

    // Apply additional filters
    if (filters?.type !== undefined) {
      query = query.where("type", "=", filters.type);
    }
    if (filters?.source !== undefined) {
      query = query.where("source", "=", filters.source);
    }
    if (filters?.duration !== undefined) {
      query = query.where("duration", "=", filters.duration);
    }
    if (filters?.lastOfferId !== undefined) {
      query = query.where("id", ">", filters.lastOfferId);
    }

    const offers = await query.selectAll().execute();

    logger.debug(
      `Got ${offers.length.toFixed()} active offers: ${offers.map((o) => o.id).join(", ")}`,
    );

    // Post-query filtering for real_valid_to
    const filteredOffers = offers.filter((offer) => {
      const realValidTo = calculateRealValidTo(
        DateTime.fromISO(offer.seen_last).toJSDate(),
        offer.valid_to ? DateTime.fromISO(offer.valid_to).toJSDate() : null,
        time,
      );
      return (
        realValidTo === null ||
        DateTime.fromJSDate(realValidTo) > DateTime.fromJSDate(time)
      );
    });

    logger.debug(
      `Filtered active offers: ${filteredOffers.map((o) => o.id).join(", ")}`,
    );
    return filteredOffers;
  } catch (error) {
    handleError("get active offers", error);
    throw new Error("Failed to get active offers");
  }
}

export async function getAllOffers(): Promise<Offer[]> {
  try {
    return await getDb()
      .selectFrom("offers")
      .selectAll()
      .orderBy("seen_first", "desc")
      .execute();
  } catch (error) {
    handleError("get all offers", error);
  }
}

export async function updateOffer(id: number, offer: OfferUpdate) {
  try {
    const result = await getDb()
      .updateTable("offers")
      .set(offer)
      .where("id", "=", id)
      .executeTakeFirst();
    handleUpdateResult(result);
    return result;
  } catch (error) {
    handleError("update offer", error);
  }
}

export async function createOrUpdateOffer(offer: NewOffer): Promise<number> {
  try {
    // Find existing offer by unique combination
    const existingOffer = await getDb()
      .selectFrom("offers")
      .select(["id"])
      .where("title", "=", offer.title)
      .where("source", "=", offer.source)
      .where("type", "=", offer.type)
      .where("duration", "=", offer.duration)
      .where("category", "=", offer.category)
      .executeTakeFirst();

    if (existingOffer !== undefined) {
      // Update seen last date
      const result = await getDb()
        .updateTable("offers")
        .set({
          seen_last: DateTime.now().toISO(),
        })
        .where("id", "=", existingOffer.id)
        .executeTakeFirst();
      handleUpdateResult(result);
      return existingOffer.id;
    }

    return await createOffer(offer);
  } catch (error) {
    handleError("create or update offer", error);
  }
}

export async function getNewOffers(
  now: Date,
  type: OfferType,
  source: OfferSource,
  duration: OfferDuration,
  lastOfferId: number,
): Promise<Offer[]> {
  try {
    let query = getDb()
      .selectFrom("offers")
      .selectAll()
      .where("id", ">", lastOfferId)
      .where("type", "=", type)
      .where("source", "=", source)
      .where("duration", "=", duration);

    // For non-ALWAYS offers, check if they're still valid
    if (duration !== OfferDuration.ALWAYS) {
      logger.debug(
        `Filtering for offers that are still valid on ${DateTime.fromJSDate(now).toISO() ?? ""}`,
      );
      query = query.where((eb) =>
        eb.or([
          eb("valid_to", "is", null),
          eb("valid_to", ">", DateTime.fromJSDate(now).toISO()),
        ]),
      );
    }

    query = query.orderBy("id", "asc");

    return await query.execute();
  } catch (error) {
    handleError("get new offers", error);
    return [];
  }
}

export async function getOffer(id: number): Promise<Offer | undefined> {
  try {
    return await getDb()
      .selectFrom("offers")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
  } catch (error) {
    handleError("get offer", error);
    return undefined;
  }
}

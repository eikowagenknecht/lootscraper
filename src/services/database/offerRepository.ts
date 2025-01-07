import { OfferDuration, type OfferType } from "@/types/basic";
import type { OfferSource } from "@/types/basic";
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

export async function getOfferById(id: number): Promise<Offer | undefined> {
  try {
    return await getDb()
      .selectFrom("offers")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
  } catch (error) {
    handleError("get offer", error);
  }
}

/**
 * Find an offer by its title and validTo date. validTo is interpreted as "at
 * most 1 day older or 1 day newer" to avoid getting duplicates for offers where
 * the exact end date is not clear.
 *
 * Offers that previously had no validTo date but now do have one are considered
 * the same offer because some sites (Steam) add the "valid to" date only when
 * the offer already has been there for a while.
 */
export async function findOffer({
  source,
  type,
  duration,
  title,
  validTo,
}: {
  source: OfferSource;
  type: OfferType;
  duration: OfferDuration;
  title: string;
  validTo: string | null;
}): Promise<Offer | undefined> {
  try {
    let query = getDb()
      .selectFrom("offers")
      .selectAll()
      .where("source", "=", source)
      .where("type", "=", type)
      .where("duration", "=", duration)
      .where("title", "=", title);

    // If validTo is provided, match offers within ±1 day or those without validTo
    if (validTo !== null) {
      const validToDate = DateTime.fromISO(validTo);
      const earliestDate = validToDate.minus({ days: 1 }).toISO();
      const latestDate = validToDate.plus({ days: 1 }).toISO();

      query = query.where((eb) =>
        eb.or([
          eb.and([
            eb("valid_to", ">=", earliestDate),
            eb("valid_to", "<=", latestDate),
          ]),
          eb("valid_to", "is", null),
        ]),
      );
    }

    const results = await query.execute();

    if (results.length === 0) {
      return undefined;
    }

    // If there's only one match, return it
    if (results.length === 1) {
      return results[0];
    }

    // If there are multiple matches, try to find exact validTo match
    logger.verbose("Multiple offers found, trying to find exact match.");
    if (validTo !== null) {
      const exactMatch = results.find((offer) => offer.valid_to === validTo);
      if (exactMatch) {
        logger.verbose("Exact match found.");
        return exactMatch;
      }
    }

    // If multiple close matches exist, return the newest one.
    // This should rarely happen and is a fallback in case the exact match
    // wasn't found.
    logger.warning(
      `Found ${results.length.toFixed()} offers for "${title}" that are close to ${
        validTo ?? "null"
      }. Returning the newest one.`,
    );

    // Return the last result (newest one based on ID)
    return results[results.length - 1];
  } catch (error) {
    handleError("find offer", error);
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

export async function getActiveOffers(
  time: Date,
  filters?: OfferFilters,
): Promise<Offer[]> {
  try {
    const seenCutoff = DateTime.fromJSDate(time)
      .minus({ hours: 24 })
      .toJSDate();

    logger.debug(`Getting active offers for ${time.toISOString()}`);

    // Do as much filtering as possible in the database query to reduce the
    // amount of data we have to process
    let query = getDb()
      .selectFrom("offers")
      .where((eb) =>
        eb.and([
          eb.or([
            // Definitely active offers
            eb("valid_from", "<=", time.toISOString()),
            // Unknown valid_from (most offers don't explicitly state this)
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
              eb("seen_last", ">=", seenCutoff.toISOString()),
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

    const filteredOffers = offers.filter((offer) => {
      // Skip entries without dates
      if (!offer.valid_from && !offer.seen_last) {
        return false;
      }

      // Skip entries that start in the future
      if (offer.valid_from && offer.valid_from <= offer.seen_last) {
        return false;
      }

      const realValidTo = calculateRealValidTo(
        DateTime.fromISO(offer.seen_last).toJSDate(),
        offer.valid_to ? DateTime.fromISO(offer.valid_to).toJSDate() : null,
        time,
      );

      // Filter out offers that have a real end date that is in the past
      if (
        realValidTo &&
        DateTime.fromJSDate(realValidTo) <= DateTime.fromJSDate(time)
      ) {
        return false;
      }

      return true;
    });

    logger.debug(
      `Filtered active offers: ${filteredOffers.map((o) => o.id).join(", ")}`,
    );
    return filteredOffers;
  } catch (error) {
    handleError("get active offers", error);
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
        `Filtering for offers that are still valid on ${DateTime.fromJSDate(now).toISO()}`,
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
  }
}

export async function createOffer(offer: NewOffer): Promise<number> {
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

export async function addMissingFieldsToOffer(
  id: number,
  newOffer: NewOffer,
): Promise<boolean> {
  const previousOffer = await getOfferById(id);
  if (!previousOffer) {
    logger.error(`Offer with ID ${id.toFixed()} not found. Can't update.`);
    return false;
  }

  let changed = false;

  const update: OfferUpdate = {};

  // Update valid_from if it's not set
  if (!previousOffer.valid_from && newOffer.valid_from) {
    update.valid_from = newOffer.valid_from;
    changed = true;
  }

  // Update valid_to if it's not set
  if (!previousOffer.valid_to && newOffer.valid_to) {
    update.valid_to = newOffer.valid_to;
    changed = true;
  }

  // Update url if it's not set
  if (!previousOffer.url && newOffer.url) {
    update.url = newOffer.url;
    changed = true;
  }

  // Update img url if it's not set
  if (!previousOffer.img_url && newOffer.img_url) {
    update.img_url = newOffer.img_url;
    changed = true;
  }

  if (!changed) {
    return false;
  }

  update.seen_last = DateTime.now().toISO();

  await updateOffer(id, update);

  return true;
}

export async function touchOffer(id: number): Promise<void> {
  await updateOffer(id, {
    seen_last: DateTime.now().toISO(),
  });
}

import { getDb } from "@/services/database";
import type {
  OfferDuration,
  OfferPlatform,
  OfferSource,
  OfferType,
} from "@/types/basic";
import type { NewOffer, Offer, OfferUpdate } from "@/types/database";
import { logger } from "@/utils/logger";
import { DateTime } from "luxon";
import { handleError, handleInsertResult, handleUpdateResult } from "./common";

interface OfferFilters {
  type?: OfferType;
  source?: OfferSource;
  duration?: OfferDuration;
  platform?: OfferPlatform;
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
 * @param options Parameters
 * @param options.source The source of the offer
 * @param options.type The type of the offer
 * @param options.duration The duration of the offer
 * @param options.platform The platform of the offer
 * @param options.title The title of the offer
 * @param options.validTo The validTo date of the offer
 * @returns The offer if found, otherwise undefined
 */
export async function findOffer({
  source,
  type,
  duration,
  platform,
  title,
  validTo,
}: {
  source: OfferSource;
  type: OfferType;
  duration: OfferDuration;
  platform: OfferPlatform;
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
      .where("platform", "=", platform)
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
    logger.warn(
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
  time: DateTime,
  filters?: OfferFilters,
): Promise<Offer[]> {
  try {
    const seenCutoff = time.minus({ hours: 24 });
    const validFromCutOff = time.minus({ months: 3 });

    logger.debug(
      `Getting active offers for ${time.toISO()} with filters: ${JSON.stringify(filters)}`,
    );

    let query = getDb()
      .selectFrom("offers")
      .where((eb) =>
        eb.not(
          eb.or([
            // 1. Skip entries that start in the future
            eb.and([
              eb("valid_from", "is not", null),
              eb("valid_from", ">", time.toISO()),
            ]),
            // 2. Skip entries that have ended
            eb.and([
              eb("valid_to", "is not", null),
              eb("valid_to", "<", time.toISO()),
            ]),
            // 3. Skip entries that have no end date and haven't been seen for more than a day
            eb.and([
              eb("valid_to", "is", null),
              eb("seen_last", "<", seenCutoff.toISO()),
            ]),
            // 4. Skip entries that have been seen for the first time more than 3 months ago.
            // Those are probably not "real" offers.
            eb("seen_first", "<", validFromCutOff.toISO()),
          ]),
        ),
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
    if (filters?.platform !== undefined) {
      query = query.where("platform", "=", filters.platform);
    }
    if (filters?.lastOfferId !== undefined) {
      query = query.where("id", ">", filters.lastOfferId);
    }

    const offers = await query.selectAll().execute();

    if (offers.length === 0) {
      logger.debug("No active offers found.");
    } else {
      logger.debug(
        `Got ${offers.length.toFixed()} active offers: ${offers.map((o) => o.id).join(", ")}`,
      );
    }

    return offers;
  } catch (error) {
    handleError("get active offers", error);
  }
}

export async function getOffersWithMissingGameInfo(): Promise<Offer[]> {
  try {
    return await getDb()
      .selectFrom("offers")
      .selectAll()
      .where("game_id", "is", null)
      .execute();
  } catch (error) {
    handleError("get offers with missing game info", error);
  }
}

export async function getChatsNeedingOffers(time: DateTime): Promise<number[]> {
  try {
    const seenCutoff = time.minus({ hours: 24 });
    const validFromCutOff = time.minus({ months: 3 });

    const query = getDb()
      .selectFrom("telegram_chats as c")
      .leftJoin("telegram_subscriptions as s", "s.chat_id", "c.id")
      .leftJoin("offers as o", (join) =>
        join.on((eb) =>
          eb.and([
            // Match subscription criteria
            eb("o.type", "=", eb.ref("s.type")),
            eb("o.source", "=", eb.ref("s.source")),
            eb("o.duration", "=", eb.ref("s.duration")),
            eb("o.platform", "=", eb.ref("s.platform")),
            // Only newer offers
            eb("o.id", ">", eb.ref("s.last_offer_id")),
            // Validity conditions
            eb.not(
              eb.or([
                // 1. Skip entries that start in the future
                eb.and([
                  eb("valid_from", "is not", null),
                  eb("valid_from", ">", time.toISO()),
                ]),
                // 2. Skip entries that have ended
                eb.and([
                  eb("valid_to", "is not", null),
                  eb("valid_to", "<", time.toISO()),
                ]),
                // 3. Skip entries that have no end date and haven't been seen for more than a day
                eb.and([
                  eb("valid_to", "is", null),
                  eb("seen_last", "<", seenCutoff.toISO()),
                ]),
                // 4. Skip entries that have been seen for the first time more than 3 months ago.
                // Those are probably not "real" offers.
                eb("seen_first", "<", validFromCutOff.toISO()),
              ]),
            ),
          ]),
        ),
      )
      .select("c.id as id")
      .where("c.active", "=", 1)
      .groupBy("c.id")
      .having((eb) => eb.fn.count("o.id"), ">", 0);

    return (await query.execute()).map((row) => row.id);
  } catch (error) {
    handleError("get chats needing offers", error);
  }
}

export async function getChatsNeedingAnnouncements(): Promise<number[]> {
  try {
    const query = getDb()
      .selectFrom("telegram_chats as c")
      .leftJoin("announcements as a", (join) =>
        join.on((eb) => eb("a.id", ">", eb.ref("c.last_announcement_id"))),
      )
      .select("c.id as id")
      .where("c.active", "=", 1)
      .groupBy("c.id")
      .having((eb) => eb.fn.count("a.id"), ">", 0);

    return (await query.execute()).map((row) => row.id);
  } catch (error) {
    handleError("get chats needing announcements", error);
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

export async function touchOffer(id: number): Promise<boolean> {
  try {
    const res = await getDb()
      .updateTable("offers")
      .set({ seen_last: DateTime.now().toISO() })
      .where("id", "=", id)
      .executeTakeFirst();

    return res.numUpdatedRows > 0;
  } catch (error) {
    handleError("touch offer", error);
  }
}

export async function clearGames() {
  try {
    await getDb()
      .transaction()
      .execute(async (trx) => {
        await trx.updateTable("offers").set({ game_id: null }).execute();
        await trx.deleteFrom("games").execute();
        await trx.deleteFrom("steam_info").execute();
        await trx.deleteFrom("igdb_info").execute();
      });
  } catch (error) {
    handleError("delete all game info", error);
  }
}

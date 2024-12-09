import { DateTime } from "luxon";

/**
 * Calculate the real end date of an offer.
 * @param seenLast - When the offer was last seen
 * @param validTo - The offer's stated end date
 * @param forcedNow - Optional date to use instead of current time (for testing)
 * @returns The calculated real end date or null if indeterminate
 */
export function calculateRealValidTo(
  seenLast: Date,
  validTo: Date | null,
  forcedNow?: Date,
): Date | null {
  const now = forcedNow ?? new Date();
  const seenLastDt = DateTime.fromJSDate(seenLast);
  const nowDt = DateTime.fromJSDate(now);

  if (!validTo) {
    // The offer has no end date and hasn't been seen for more than a day
    if (nowDt > seenLastDt.plus({ days: 1 })) {
      return seenLast;
    }
    // The offer has no end date and is still there. So we know nothing.
    return null;
  }

  const validToDt = DateTime.fromJSDate(validTo);

  // The offer had an end date but hasn't been seen for more than an hour
  if (validToDt > seenLastDt.plus({ hours: 1 })) {
    // The offer has been seen in the last day, we don't force end it yet.
    // Maybe the site is just down for a while.
    if (nowDt < seenLastDt.plus({ days: 1 })) {
      return validTo;
    }

    // The offer has not been seen in the last day. It's probably gone.
    // So the real end date is the last time we saw it.
    return seenLast;
  }

  // The offer should have ended, but it's still there. So we approximate the
  // end date by adding 1 hour to the last time we saw it.
  if (validToDt < seenLastDt) {
    return seenLastDt.plus({ hours: 1 }).toJSDate();
  }

  // In all other cases, we believe what the offer says.
  return validTo;
}

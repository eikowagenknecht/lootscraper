import type { DateTime } from "luxon";

/**
 * Calculate the real end date of an offer.
 * @param seenLast - When the offer was last seen
 * @param validTo - The offer's stated end date
 * @param now - Optional date to use instead of current time (for testing)
 * @returns The calculated real end date or null if indeterminate
 */
export function calculateRealValidTo(
  seenLast: DateTime,
  validTo: DateTime | null,
  now: DateTime,
): DateTime | null {
  if (!validTo) {
    // The offer has no end date and hasn't been seen for more than a day
    if (now > seenLast.plus({ days: 1 })) {
      return seenLast;
    }
    // The offer has no end date and is still there.
    // It's still valid, but we don't know anything about the real end date.
    return null;
  }

  // The offer had an end date but hasn't been seen for more than an hour
  if (validTo > seenLast.plus({ hours: 1 })) {
    // The offer has been seen in the last day, we don't force end it yet.
    // Maybe the site is just down for a while.
    if (now <= seenLast.plus({ days: 1 })) {
      return validTo;
    }

    // The offer has not been seen in the last day. It's probably gone.
    // So the real end date is the last time we saw it.
    return seenLast;
  }

  // The offer should have ended, but it's still there. So we approximate the
  // end date by adding 1 hour to the last time we saw it.
  if (validTo < seenLast) {
    return seenLast.plus({ hours: 1 });
  }

  // In all other cases, we believe what the offer says.
  return validTo;
}

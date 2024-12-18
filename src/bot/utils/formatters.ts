import { OfferDuration } from "@/types/config";
import type { Offer } from "@/types/database";
import { DateTime } from "luxon";
import { bold, escapeText, link } from "./markdown";

const TIMESTAMP_READABLE_WITH_HOUR = "yyyy-MM-dd - HH:mm";

interface FormatOfferMessageOptions {
  tzOffset?: number | null;
  includeDetails?: boolean;
}

export function formatOfferMessage(
  offer: Offer,
  options: FormatOfferMessageOptions = {},
): string {
  const { tzOffset = 0, includeDetails = false } = options;
  let content = "";

  // Basic offer info
  content += bold(
    escapeText(
      `${offer.title} - ${offer.source} (${offer.type}${offer.duration !== OfferDuration.CLAIMABLE ? `, ${offer.duration}` : ""})`,
    ),
  );
  content += escapeText(` [${offer.id.toFixed()}`);

  // Image
  if (offer.img_url) {
    content += link(offer.img_url, "*");
  }
  content += escapeText("]");

  // Claim URL
  if (offer.url) {
    content += escapeText(" - ") + link(offer.url, "[Claim here]");
  }

  content += "\n\n";

  // Time information
  if (offer.valid_to) {
    const validTo = DateTime.fromISO(offer.valid_to);
    const validToFormatted = tzOffset
      ? validTo
          .setZone(`UTC${tzOffset >= 0 ? "+" : ""}${tzOffset.toFixed()}`)
          .toFormat(`${TIMESTAMP_READABLE_WITH_HOUR} z`)
      : validTo.toUTC().toFormat(`${TIMESTAMP_READABLE_WITH_HOUR} UTC`);

    const now = DateTime.now();
    const diff = validTo.diff(now, ["days", "hours"]);
    const diffHuman = diff.toHuman({ maximumFractionDigits: 0 });

    if (now > validTo) {
      content += escapeText(
        `Offer expired ${diffHuman} ago (${validToFormatted}).`,
      );
    } else {
      content += escapeText(
        `Offer expires in ${diffHuman} (${validToFormatted}).`,
      );
    }
  } else if (offer.duration === OfferDuration.ALWAYS) {
    content += escapeText("Offer will stay free, no need to hurry.");
  } else {
    content += escapeText("Offer has no known end date.");
  }

  if (!includeDetails) {
    return content;
  }

  // Add offer details
  if (offer.category) {
    content += `\n${bold("Category:")}${escapeText(offer.category)}`;
  }

  content += `\n${bold("Raw Info:")}${escapeText(JSON.stringify(offer.rawtext, null, 2))}`;

  return content;
}

import { OfferDuration } from "@/types/config";
import type { Offer } from "@/types/database";
// src/bot/utils/formatters.ts
import { DateTime } from "luxon";
import { bold, escapeText, link } from "./markdown";

export interface FormatOfferMessageOptions {
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
    `${offer.title} - ${offer.source} (${offer.type}${offer.duration !== OfferDuration.CLAIMABLE ? `, ${offer.duration}` : ""})`,
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
          .toFormat("MMMM d, yyyy HH:mm z")
      : validTo.toUTC().toFormat("MMMM d, yyyy HH:mm 'UTC'");

    const now = DateTime.now().setZone("UTC");
    const diff = validTo.diff(now);
    const diffHuman = diff.toHuman({ maximumFractionDigits: 0 });

    if (now > validTo) {
      content += `Offer expired ${escapeText(diffHuman)} ago`;
    } else {
      content += `Offer expires in ${escapeText(diffHuman)}`;
    }
    content += escapeText(` (${validToFormatted}).`);
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
    content += `\n*Category:* ${escapeText(offer.category)}`;
  }

  content += `\n*Raw Info:* ${escapeText(JSON.stringify(offer.rawtext, null, 2))}`;

  return content;
}

import { OfferDuration } from "@/types/config";
import type { Offer } from "@/types/database";
// src/bot/utils/formatters.ts
import { DateTime } from "luxon";
import { url, bold, escapeMarkdown } from "./markdown";

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
  content += escapeMarkdown(` [${offer.id.toFixed(0)}`);

  // Image
  if (offer.img_url) {
    content += url(offer.img_url, "*");
  }
  content += escapeMarkdown("]");

  // Claim URL
  if (offer.url) {
    content += escapeMarkdown(" - ") + url(offer.url, "[Claim here]");
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
      content += `Offer expired ${escapeMarkdown(diffHuman)} ago`;
    } else {
      content += `Offer expires in ${escapeMarkdown(diffHuman)}`;
    }
    content += escapeMarkdown(` (${validToFormatted}).`);
  } else if (offer.duration === OfferDuration.ALWAYS) {
    content += escapeMarkdown("Offer will stay free, no need to hurry.");
  } else {
    content += escapeMarkdown("Offer has no known end date.");
  }

  if (!includeDetails) {
    return content;
  }

  // Add offer details
  if (offer.category) {
    content += `\n*Category:* ${escapeMarkdown(offer.category)}`;
  }

  content += `\n*Raw Info:* ${escapeMarkdown(JSON.stringify(offer.rawtext, null, 2))}`;

  return content;
}

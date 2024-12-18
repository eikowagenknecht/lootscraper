import { getGameWithInfo } from "@/services/database/gameRepository";
import { OfferDuration } from "@/types/config";
import type { Offer } from "@/types/database";
import { DateTime } from "luxon";
import { bold, escapeText, italic, link } from "./markdown";

const TIMESTAMP_READABLE_WITH_HOUR = "yyyy-MM-dd - HH:mm";
const TIMESTAMP_SHORT = "yyyy-MM-dd";

interface FormatOfferMessageOptions {
  tzOffset?: number | null;
  includeDetails?: boolean;
}

export async function formatOfferMessage(
  offer: Offer,
  options: FormatOfferMessageOptions = {},
): Promise<string> {
  const { tzOffset = 0, includeDetails = false } = options;
  let content = "";

  const game = offer.game_id ? await getGameWithInfo(offer.game_id) : null;

  // Basic offer info
  const additionalInfo =
    offer.duration !== OfferDuration.CLAIMABLE
      ? `${offer.type}, ${offer.duration}`
      : offer.type;

  content += bold(`${offer.title} - ${offer.source} (${additionalInfo})`);
  content += escapeText(` [${offer.id.toFixed()}`);

  // Image
  if (offer.img_url) {
    content += link(offer.img_url, "*");
  } else if (game?.steamInfo?.image_url) {
    content += link(game.steamInfo.image_url, "*");
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
          .toFormat(
            `${TIMESTAMP_READABLE_WITH_HOUR} UTC${tzOffset >= 0 ? "+" : "-"}${tzOffset.toFixed()}`,
          )
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

  if (
    !includeDetails ||
    game === null ||
    (game.igdbInfo === null && game.steamInfo === null)
  ) {
    return content;
  }

  // Game title header
  if (game.igdbInfo?.name) {
    content += `\n\n${italic(`More info about "${game.igdbInfo.name}":`)}\n`;
  } else if (game.steamInfo?.name) {
    content += `\n\n${italic(`More info about "${game.steamInfo.name}":`)}\n`;
  } else {
    return content;
  }

  // Ratings section
  const ratings: string[] = [];

  if (game.steamInfo?.metacritic_score) {
    let text = `Metacritic ${game.steamInfo.metacritic_score.toFixed()} %`;
    if (game.steamInfo.metacritic_url) {
      text = link(game.steamInfo.metacritic_url, text);
    }
    ratings.push(text);
  }

  if (
    game.steamInfo?.percent &&
    game.steamInfo.score &&
    game.steamInfo.recommendations &&
    game.steamInfo.url
  ) {
    const text =
      `Steam ${game.steamInfo.percent.toFixed()} % ` +
      `(${game.steamInfo.score.toFixed()}/10, ` +
      `${game.steamInfo.recommendations.toFixed()} recommendations)`;
    ratings.push(link(game.steamInfo.url, text));
  }

  if (
    game.igdbInfo?.meta_ratings &&
    game.igdbInfo.meta_score &&
    game.igdbInfo.url
  ) {
    const text =
      `IGDB Meta ${game.igdbInfo.meta_score.toFixed()} % ` +
      `(${game.igdbInfo.meta_ratings.toFixed()} sources)`;
    ratings.push(link(game.igdbInfo.url, text));
  }

  if (
    game.igdbInfo?.user_ratings &&
    game.igdbInfo.user_score &&
    game.igdbInfo.url
  ) {
    const text =
      `IGDB User ${game.igdbInfo.user_score.toFixed()} % ` +
      `(${game.igdbInfo.user_ratings.toFixed()} sources)`;
    ratings.push(link(game.igdbInfo.url, text));
  }

  if (ratings.length > 0) {
    content += `${bold("Ratings:")} ${ratings.join(" / ")}\n`;
  }

  // Release date
  if (game.igdbInfo?.release_date) {
    content += `${bold("Release date:")} ${escapeText(
      DateTime.fromISO(game.igdbInfo.release_date).toFormat(TIMESTAMP_SHORT),
    )}\n`;
  } else if (game.steamInfo?.release_date) {
    content += `${bold("Release date:")} ${escapeText(
      DateTime.fromISO(game.steamInfo.release_date).toFormat(TIMESTAMP_SHORT),
    )}\n`;
  }

  // Price
  if (game.steamInfo?.recommended_price_eur) {
    content += `${bold("Recommended price (Steam):")} ${escapeText(game.steamInfo.recommended_price_eur.toFixed(2))} EUR\n`;
  }

  // Genres
  if (game.steamInfo?.genres) {
    content += `${bold("Genres:")} ${escapeText(game.steamInfo.genres)}\n`;
  }

  // Description
  if (game.igdbInfo?.short_description) {
    content += `${bold("Description:")} ${escapeText(game.igdbInfo.short_description)}\n`;
  } else if (game.steamInfo?.short_description) {
    content += `${bold("Description:")} ${escapeText(game.steamInfo.short_description)}\n`;
  }

  return content;
}

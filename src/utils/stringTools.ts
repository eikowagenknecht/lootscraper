import {
  type FeedCombination,
  getEnabledFeedCombinations,
} from "@/services/scraper/utils";
import { translationService } from "@/services/translation";
import { OfferDuration } from "@/types";

const RESULT_MATCH_THRESHOLD = 0.85;

function getSequenceMatchRatio(a: string, b: string): number {
  let longer = a;
  let shorter = b;

  if (a.length < b.length) {
    longer = b;
    shorter = a;
  }

  const longerLength = longer.length;
  if (longerLength === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longerLength - editDistance) / longerLength;
}

function levenshteinDistance(s1: string, s2: string): number {
  const costs: number[] = [];

  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) {
      costs[s2.length] = lastValue;
    }
  }

  return costs[s2.length];
}

/**
 * TODO: This is currently a Claude-generated Levenshtein distance algorithm.
 * The results need to be checked against the Python difflib implementation.
 * If they are not close enough, it should be replaced with e.g. fuse.js.
 *
 * @param search
 * @param result
 * @returns
 */
export function getMatchScore(search: string, result: string): number {
  // Clean strings: keep only alphanumeric and spaces, condense spaces
  const cleanedSearch = search
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .replace(/ +/g, " ")
    .toLowerCase();

  const cleanedResult = result
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .replace(/ +/g, " ")
    .toLowerCase();

  let score = getSequenceMatchRatio(cleanedSearch, cleanedResult);

  // If it is no match, look for a partial match instead. Look at the
  // first x or last x words from the result because the result often
  // includes additional text (e.g. a prepended "Tom Clancy's ...") or
  // an appended " - Ultimate edition". x is the number of words the
  // search term has.
  if (score < RESULT_MATCH_THRESHOLD) {
    // Try partial matches if full match score is too low
    const wordsResult = cleanedResult.split(" ");
    const wordsSearch = cleanedSearch.split(" ");
    const searchLength = wordsSearch.length;

    // Try matching with first x words
    const startScore = getSequenceMatchRatio(
      cleanedSearch,
      wordsResult.slice(0, searchLength).join(" "),
    );

    // Try matching with last x words
    const endScore = getSequenceMatchRatio(
      cleanedSearch,
      wordsResult.slice(-searchLength).join(" "),
    );

    // This score needed some help, there is a small penalty for it, so for example
    // Cities: Skylines is preferred over
    // Cities: Skylines - One more DLC
    score = Math.max(score, startScore, endScore) - 0.01;
  }

  return Math.max(score, 0);
}

/**
 * Replace non-Latin characters with their closest representation and replace
 * the quote sign (") because that would break the query.
 *
 * @param str
 * @returns
 */
export function normalizeString(str: string): string {
  // First normalize to decomposed form (NFD), which separates base characters from diacritics
  // Then replace all combining diacritical marks (unicode category "M")
  // Finally replace double quotes and trim the result
  return str.normalize("NFD").replace(/\p{M}/gu, "").replace(/"/g, "").trim();
}

export function cleanHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "") // Remove HTML comments, single and multiline
    .split("\n")
    .map((line) => line.trimEnd()) // Remove trailing whitespace
    .filter((line) => line.trim() !== "") // Remove empty lines
    .join("\n");
}
export function cleanGameTitle(title: string): string {
  return title
    .replace(/\n/g, "")
    .replace(/ - /g, ": ")
    .replace(/ : /g, ": ")
    .trim()
    .replace(/^\[ ?VIP ?\]/g, "")
    .replace(/ on Origin$/g, "")
    .replace(/ Game of the Year Edition( Deluxe)?$/g, "")
    .replace(/ (Definitive|Deluxe|Collectors) Edition$/g, "")
    .replace(/ \(Mobile\)$/g, "")
    .replace(/ \([1-9]{4}\)$/g, "") // Remove years in brackets
    .trim()
    .replace(/[:|-]$/g, "")
    .trim();
}

export function cleanLootTitle(title: string): string {
  return title
    .replace(/\n/g, "")
    .replace(/ - /g, ": ")
    .replace(/ : /g, ": ")
    .trim()
    .replace(/[:|-]$/g, "")
    .trim();
}
/**
 * Clean the combined title.
 *
 * Unfortunately loot offers come in free text format, so we need to do some
 * manual matching.
 *
 * Most of the time, it is the part before the first ": ", e.g.
 *   "Lords Mobile: Warlord Pack"
 *   -> "Lords Mobile"
 *
 * When the title itself contains a ": ", it can also be the second, e.g.
 *   "Mobile Legends: Bang Bang: Amazon Prime Chest"
 *   -> Mobile Legends: Bang Bang
 *
 * Sometimes it also ist "Get ... in [Game]", e.g.
 *   "Get up to GTA$400,000 this month in GTA Online"
 *   -> GTA Online
 *
 * We use the same method for Steam loot offers for now as they also seem to
 * be seperated in the same fashion.
 *
 * Sometimes Steam uses " — " (warning: this is a special unicode character)
 * for the separation of game and loot name and the loot itself also
 * contains a ": ". In this case, we can just use the part before the " — "
 * as the game name, e.g.
 *   "World of Warships — Starter Pack: Dreadnought"
 *   -> World of Warships: Starter Pack
 *
 * So as a general rule, we try splitting in this order:
 * 1. Special Steam format (TITLE — LOOT: LOOTDETAIL)
 * 2. By the second colon (TITLE: TITLEDETAIL: LOOTDETAIL)
 * 3. By the "Get ... in [Game] pattern" (to catch games with a colon in the name)
 * 4. By the ": " pattern (TITLE: LOOT)
 *
 * @param title The combined title as seen in the offer
 * @returns Both the probable game name and the resulting offer title
 */

export function cleanCombinedTitle(title: string): [string, string] {
  let probableGameName = "";
  let probableLootName = "";

  // Clean up input
  const cleanTitle = title.replace(/\n/g, " ").trim();

  // Special Steam format (TITLE — LOOT: LOOTDETAIL)
  const specialMatch = /^(.*) — (.*: .*)$/.exec(cleanTitle);
  if (specialMatch?.[1]) {
    probableGameName = specialMatch[1];
    probableLootName = specialMatch[2];
  }

  if (!probableGameName) {
    // Replace some very special characters that Steam uses sometimes
    const normalizedTitle = cleanTitle
      .replace(/：/g, ": ")
      .replace(/ — /g, ": ")
      .replace(/ - /g, ": ");

    const titleParts = normalizedTitle.split(": ");

    // By the second colon (TITLE: TITLEDETAIL: LOOTDETAIL)
    if (titleParts.length >= 3) {
      probableGameName = titleParts.slice(0, -1).join(": ");
      probableLootName = titleParts[titleParts.length - 1];
    }

    // By the "Get ... in [Game] pattern" (to catch games with a colon in the name)
    if (!probableGameName) {
      const getInMatch = /^Get (.*) in (.*)$/.exec(cleanTitle);
      if (getInMatch?.[1]) {
        probableGameName = getInMatch[2];
        probableLootName = getInMatch[1];
      }
    }

    // By the ": " pattern (TITLE: LOOT)
    if (!probableGameName && titleParts.length === 2) {
      probableGameName = titleParts[0];
      probableLootName = titleParts[1];
    }

    // If we still don't have a game name, we just use the whole title
    if (!probableGameName) {
      probableGameName = cleanTitle;
    }
  }

  // Clean game name
  probableGameName = cleanGameTitle(probableGameName);

  // Capitalize first letter of loot name
  probableLootName = probableLootName.trim();
  if (probableLootName) {
    probableLootName =
      probableLootName.charAt(0).toUpperCase() + probableLootName.slice(1);
  }

  // Construct final title
  const resultingOfferTitle = probableLootName
    ? `${probableGameName} - ${probableLootName}`
    : probableGameName;

  return [probableGameName, resultingOfferTitle];
}

export function generateFilename({
  prefix,
  extension,
  combination,
  withHistory,
}: {
  prefix: string;
  extension: string;
  combination?: FeedCombination;
  withHistory?: boolean;
}): string {
  const parts = [prefix];
  if (combination) {
    parts.push(combination.source.toLowerCase());
    parts.push(combination.type.toLowerCase());
    if (combination.duration !== OfferDuration.CLAIMABLE) {
      parts.push(combination.duration.toLowerCase());
    }
  }
  if (withHistory) {
    parts.push("all");
  }
  return `${parts.join("_")}.${extension}`;
}

export function generateFeedTitle(combination?: FeedCombination): string {
  // Return default title if no options specified
  if (!combination) {
    return translationService.getFeedTitle();
  }

  return translationService.getFeedTitle(
    combination.source,
    combination.type,
    combination.duration,
  );
}

export function getEnabledFeedFilenames({
  prefix,
  extension,
  enabledCombinations,
  withHistory,
}: {
  prefix: string;
  extension: string;
  enabledCombinations?: FeedCombination[];
  withHistory?: boolean;
}): string[] {
  if (!enabledCombinations)
    return [
      generateFilename({
        prefix: prefix,
        extension: extension,
        ...(withHistory && { withHistory: true }),
      }),
    ];
  const res: string[] = [];
  for (const combination of enabledCombinations) {
    res.push(
      generateFilename({
        prefix: prefix,
        extension: extension,
        combination: combination,
        ...(withHistory && { withHistory: true }),
      }),
    );
  }
  return res;
}

export function getAllEnabledFeedFilenames(prefix: string) {
  const res: string[] = [];
  // Main xml feed
  res.push(
    ...getEnabledFeedFilenames({
      prefix: prefix,
      extension: "xml",
    }),
  );
  // Main html feed
  res.push(
    ...getEnabledFeedFilenames({
      prefix: prefix,
      extension: "html",
    }),
  );
  // Main html feed - History
  res.push(
    ...getEnabledFeedFilenames({
      prefix: prefix,
      extension: "html",
      withHistory: true,
    }),
  );
  // Source xml feeds
  res.push(
    ...getEnabledFeedFilenames({
      prefix: prefix,
      extension: "xml",
      enabledCombinations: getEnabledFeedCombinations(),
    }),
  );
  // Source html feeds
  res.push(
    ...getEnabledFeedFilenames({
      prefix: prefix,
      extension: "html",
      enabledCombinations: getEnabledFeedCombinations(),
    }),
  );
  // Source html feeds - History
  res.push(
    ...getEnabledFeedFilenames({
      prefix: prefix,
      extension: "html",
      enabledCombinations: getEnabledFeedCombinations(),
      withHistory: true,
    }),
  );

  return res;
}

/**
 * Splits a string into chunks, preferring natural word boundaries up to the maximum size
 * @param input The string to split into chunks
 * @param maxChunkSize The maximum size of each chunk
 * @returns An array of string chunks
 * @throws If maxChunkSize is less than 1
 */
export function splitIntoChunks(input: string, maxChunkSize: number): string[] {
  if (maxChunkSize < 1) {
    throw new Error("Chunk size must be at least 1");
  }

  const chunks: string[] = [];
  let currentPosition = 0;

  while (currentPosition < input.length) {
    // If remaining text is shorter than max size, take it all
    if (currentPosition + maxChunkSize >= input.length) {
      chunks.push(input.slice(currentPosition));
      break;
    }

    let cutPosition = currentPosition + maxChunkSize;

    // Look for natural break points
    const naturalBreaks = [
      input.lastIndexOf(" ", cutPosition),
      input.lastIndexOf("-", cutPosition),
      input.lastIndexOf(",", cutPosition),
      input.lastIndexOf(";", cutPosition),
      input.lastIndexOf(".", cutPosition),
    ].filter((pos): pos is number => pos > currentPosition);

    // If we found any natural break points, use the latest one
    if (naturalBreaks.length > 0) {
      cutPosition = Math.max(...naturalBreaks);
      // Move past the break character for next chunk
      const nextPosition = cutPosition + 1;
      chunks.push(input.slice(currentPosition, nextPosition));
      currentPosition = nextPosition;
    } else {
      // No natural breaks found, cut at max size
      chunks.push(input.slice(currentPosition, cutPosition));
      currentPosition = cutPosition;
    }

    // Skip leading spaces in next chunk
    while (input[currentPosition] === " ") {
      currentPosition += 1;
    }
  }

  return chunks;
}

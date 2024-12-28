import {
  type ScraperCombination,
  getEnabledScraperCombinations,
} from "@/scrapers/utils";
import { config } from "@/services/config";
import { OfferDuration, OfferType } from "@/types/basic";
import { toCapitalCaseAll } from "./stringTools";

export interface FilenameOptions {
  prefix: string;
  extension: string;
  combination?: ScraperCombination;
  withHistory?: boolean;
}

export function generateFilename(options: FilenameOptions): string {
  const parts = [options.prefix];
  if (options.combination) {
    parts.push(options.combination.source.toLowerCase());
    parts.push(options.combination.type.toLowerCase());
    if (options.combination.duration !== OfferDuration.CLAIMABLE) {
      parts.push(options.combination.duration.toLowerCase());
    }
  }
  if (options.withHistory) {
    parts.push("all");
  }
  return `${parts.join("_")}.${options.extension}`;
}

export function generateFeedTitle(combinations?: ScraperCombination): string {
  // Return default title if no options specified
  if (!combinations) {
    return "Free Games and Loot";
  }

  const parts: string[] = ["Free"];

  parts.push(toCapitalCaseAll(combinations.source));

  if (combinations.type === OfferType.GAME) {
    parts.push("Games");
  } else {
    parts.push("Loot");
  }

  if (
    combinations.duration === OfferDuration.TEMPORARY ||
    combinations.duration === OfferDuration.ALWAYS
  ) {
    parts.push(`(${combinations.duration})`);
  }

  return parts.join(" ");
}

interface EnapledFeedFilenameOptions {
  prefix: string;
  extension: string;
  enabledCombinations?: ScraperCombination[];
  withHistory?: boolean;
}
export function getEnabledFeedFilenames(
  options: EnapledFeedFilenameOptions,
): string[] {
  if (!options.enabledCombinations)
    return [
      generateFilename({
        prefix: options.prefix,
        extension: options.extension,
        ...(options.withHistory && { withHistory: true }),
      }),
    ];
  const res: string[] = [];
  for (const combination of options.enabledCombinations) {
    res.push(
      generateFilename({
        prefix: options.prefix,
        extension: options.extension,
        combination: combination,
        ...(options.withHistory && { withHistory: true }),
      }),
    );
  }
  return res;
}

export function getAllEnabledFeedFilenames() {
  const cfg = config.get();

  const res: string[] = [];
  // Main xml feed
  res.push(
    ...getEnabledFeedFilenames({
      prefix: cfg.common.feedFilePrefix,
      extension: "xml",
    }),
  );
  // Main html feed
  res.push(
    ...getEnabledFeedFilenames({
      prefix: cfg.common.feedFilePrefix,
      extension: "html",
    }),
  );
  // Main html feed - History
  res.push(
    ...getEnabledFeedFilenames({
      prefix: cfg.common.feedFilePrefix,
      extension: "html",
      withHistory: true,
    }),
  );
  // Source xml feeds
  res.push(
    ...getEnabledFeedFilenames({
      prefix: cfg.common.feedFilePrefix,
      extension: "xml",
      enabledCombinations: getEnabledScraperCombinations(),
    }),
  );
  // Source html feeds
  res.push(
    ...getEnabledFeedFilenames({
      prefix: cfg.common.feedFilePrefix,
      extension: "html",
      enabledCombinations: getEnabledScraperCombinations(),
    }),
  );
  // Source html feeds - History
  res.push(
    ...getEnabledFeedFilenames({
      prefix: cfg.common.feedFilePrefix,
      extension: "html",
      enabledCombinations: getEnabledScraperCombinations(),
      withHistory: true,
    }),
  );

  return res;
}

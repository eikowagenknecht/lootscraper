import {
  type ScraperCombination,
  getEnabledScraperCombinations,
} from "@/scrapers/utils";
import { config } from "@/services/config";
import { translationService } from "@/services/translation";
import { OfferDuration } from "@/types/basic";

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

export function generateFeedTitle(combination?: ScraperCombination): string {
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

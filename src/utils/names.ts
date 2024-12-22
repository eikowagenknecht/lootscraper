import { OfferDuration, type OfferSource, OfferType } from "@/types/config";
import { toCapitalCaseAll } from "./stringTools";

export interface FilenameOptions {
  prefix: string;
  extension: string;
  source?: OfferSource;
  type?: OfferType;
  duration?: OfferDuration;
  all?: boolean;
}

export interface FeedTitleOptions {
  source?: OfferSource;
  type?: OfferType;
  duration?: OfferDuration;
}

export function generateFilename(options: FilenameOptions): string {
  const parts = [options.prefix];
  if (options.source) parts.push(options.source.toLowerCase());
  if (options.type) parts.push(options.type.toLowerCase());
  if (options.duration !== OfferDuration.CLAIMABLE) {
    if (options.duration) parts.push(options.duration.toLowerCase());
  }
  if (options.all) {
    parts.push("all");
  }
  return `${parts.join("_")}.${options.extension}`;
}

export function generateFeedTitle(options: FeedTitleOptions) {
  // Return default title if no options specified
  if (!options.source && !options.type && !options.duration) {
    return "Free Games and Loot";
  }

  const parts: string[] = ["Free"];

  if (options.source) {
    parts.push(toCapitalCaseAll(options.source));
  }

  if (options.type === OfferType.GAME) {
    parts.push("Games");
  } else if (options.type === OfferType.LOOT) {
    parts.push("Loot");
  }

  if (
    options.duration === OfferDuration.TEMPORARY ||
    options.duration === OfferDuration.ALWAYS
  ) {
    parts.push(`(${options.duration})`);
  }

  return parts.join(" ");
}

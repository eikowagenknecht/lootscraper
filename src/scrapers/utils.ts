import { config } from "@/services/config";
import type { OfferDuration, OfferSource, OfferType } from "@/types/config";
import {
  AmazonGamesScraper,
  AmazonLootScraper,
  AppleGamesScraper,
  EpicGamesScraper,
  GogGamesAlwaysFreeScraper,
  GogGamesScraper,
  GoogleGamesScraper,
  HumbleGamesScraper,
  SteamGamesScraper,
  SteamLootScraper,
  UbisoftGamesScraper,
} from "./implementations";
import { ItchGamesScraper } from "./implementations/itch";

export interface ScraperCombination {
  source: OfferSource;
  type: OfferType;
  duration: OfferDuration;
}

const allScrapers = [
  AmazonGamesScraper,
  AmazonLootScraper,
  AppleGamesScraper,
  EpicGamesScraper,
  ItchGamesScraper,
  GogGamesScraper,
  GogGamesAlwaysFreeScraper,
  GoogleGamesScraper,
  HumbleGamesScraper,
  SteamGamesScraper,
  SteamLootScraper,
  UbisoftGamesScraper,
];

export type ScraperClass = typeof allScrapers;

export type ScraperInstance = InstanceType<ScraperClass[number]>;

// Get all unique combinations of source/type/duration from the available scrapers
export function getEnabledScraperCombinations(): ScraperCombination[] {
  const combinations: ScraperCombination[] = [];
  const cfg = config.get();

  // Get combinations from all scrapers
  for (const Scraper of allScrapers) {
    const combination: ScraperCombination = {
      source: Scraper.prototype.getSource(),
      type: Scraper.prototype.getType(),
      duration: Scraper.prototype.getDuration(),
    };

    // Only include scrapers that are enabled in config
    if (
      !cfg.scraper.offerSources.includes(combination.source) ||
      !cfg.scraper.offerTypes.includes(combination.type) ||
      !cfg.scraper.offerDurations.includes(combination.duration)
    ) {
      continue;
    }

    combinations.push(combination);
  }

  return combinations;
}

export function getEnabledScraperClasses(): ScraperClass {
  const cfg = config.get();
  return allScrapers.filter((Scraper) => {
    const combination: ScraperCombination = {
      source: Scraper.prototype.getSource(),
      type: Scraper.prototype.getType(),
      duration: Scraper.prototype.getDuration(),
    };

    return (
      cfg.scraper.offerSources.includes(combination.source) &&
      cfg.scraper.offerTypes.includes(combination.type) &&
      cfg.scraper.offerDurations.includes(combination.duration)
    );
  });
}

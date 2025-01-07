import { config } from "@/services/config";
import type { OfferDuration, OfferSource, OfferType } from "@/types/basic";
import type { Config } from "@/types/config";
import {
  AmazonGamesScraper,
  AmazonLootScraper,
  AppleGamesScraper,
  EpicGamesScraper,
  GogGamesAlwaysFreeScraper,
  GogGamesScraper,
  GoogleGamesScraper,
  HumbleGamesScraper,
  ItchGamesScraper,
  SteamGamesScraper,
  SteamLootScraper,
  UbisoftGamesScraper,
} from "./implementations";

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
  GogGamesScraper,
  GogGamesAlwaysFreeScraper,
  GoogleGamesScraper,
  HumbleGamesScraper,
  ItchGamesScraper,
  SteamGamesScraper,
  SteamLootScraper,
  UbisoftGamesScraper,
];

export type ScraperClass = typeof allScrapers;

export type ScraperInstance = InstanceType<ScraperClass[number]>;

// Helper function to get scraper combination
function getScraperCombination(
  Scraper: ScraperClass[number],
): ScraperCombination {
  return {
    source: Scraper.prototype.getSource(),
    type: Scraper.prototype.getType(),
    duration: Scraper.prototype.getDuration(),
  };
}

// Helper function to check if scraper is enabled in config
function isScraperEnabled(
  combination: ScraperCombination,
  cfg: Config,
): boolean {
  return (
    cfg.scraper.offerSources.includes(combination.source) &&
    cfg.scraper.offerTypes.includes(combination.type) &&
    cfg.scraper.offerDurations.includes(combination.duration)
  );
}

// Get all unique combinations of source/type/duration from the available scrapers
export function getEnabledScraperCombinations(): ScraperCombination[] {
  const combinations: ScraperCombination[] = [];
  const cfg = config.get();

  for (const Scraper of allScrapers) {
    const combination = getScraperCombination(Scraper);
    if (isScraperEnabled(combination, cfg)) {
      combinations.push(combination);
    }
  }

  return combinations;
}

export function getEnabledScraperClasses(): ScraperClass {
  const cfg = config.get();
  return allScrapers.filter((Scraper) =>
    isScraperEnabled(getScraperCombination(Scraper), cfg),
  );
}

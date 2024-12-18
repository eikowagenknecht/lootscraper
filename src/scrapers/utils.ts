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

interface ScraperCombination {
  source: OfferSource;
  type: OfferType;
  duration: OfferDuration;
}

const allScrapers = [
  EpicGamesScraper,
  SteamGamesScraper,
  SteamLootScraper,
  GogGamesScraper,
  GogGamesAlwaysFreeScraper,
  AmazonGamesScraper,
  AmazonLootScraper,
  HumbleGamesScraper,
  UbisoftGamesScraper,
  GoogleGamesScraper,
  AppleGamesScraper,
];

// Get all unique combinations of source/type/duration from the available scrapers
export function getEnabledScraperCombinations(): ScraperCombination[] {
  const combinations: ScraperCombination[] = [];
  const cfg = config.get();

  // Get combinations from all scrapers
  for (const Scraper of allScrapers) {
    const source = Scraper.prototype.getSource();
    const type = Scraper.prototype.getType();
    const duration = Scraper.prototype.getDuration();

    // Only include scrapers that are enabled in config
    if (
      !cfg.scraper.offerSources.includes(source) ||
      !cfg.scraper.offerTypes.includes(type) ||
      !cfg.scraper.offerDurations.includes(duration)
    ) {
      continue;
    }

    combinations.push({
      source,
      type,
      duration,
    });
  }

  return combinations;
}

import { config } from "@/services/config";
import type { OfferDuration, OfferSource, OfferType } from "@/types/basic";
import type { Config } from "@/types/config";
import type { CronConfig } from "./base/scraper";
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

export interface FeedCombination {
  source: OfferSource;
  type: OfferType;
  duration: OfferDuration;
}

interface ScraperSchedule {
  name: string;
  schedule: CronConfig[];
}

export const allScrapers = [
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

export type ScraperClass =
  | typeof AmazonGamesScraper
  | typeof AmazonLootScraper
  | typeof AppleGamesScraper
  | typeof EpicGamesScraper
  | typeof GogGamesScraper
  | typeof GogGamesAlwaysFreeScraper
  | typeof GoogleGamesScraper
  | typeof HumbleGamesScraper
  | typeof ItchGamesScraper
  | typeof SteamGamesScraper
  | typeof SteamLootScraper
  | typeof UbisoftGamesScraper;

export type ScraperInstance = InstanceType<ScraperClass>;

export function getScraperSchedule(Scraper: ScraperClass): ScraperSchedule {
  return {
    name: Scraper.prototype.getScraperName(),
    schedule: Scraper.prototype.getSchedule(),
  };
}

// Helper function to check if scraper is enabled in config
function isScraperEnabled(name: string, cfg: Config): boolean {
  return cfg.scraper.enabledScrapers.includes(name);
}

export function getEnabledScraperClasses(): ScraperClass[] {
  const cfg = config.get();
  return allScrapers.filter((Scraper) =>
    isScraperEnabled(Scraper.prototype.getScraperName(), cfg),
  );
}

export function getEnabledFeedCombinations(): FeedCombination[] {
  const combinations: FeedCombination[] = [];
  const enabledScraperClasses = getEnabledScraperClasses();

  for (const scraperClass of enabledScraperClasses) {
    combinations.push({
      source: scraperClass.prototype.getSource(),
      type: scraperClass.prototype.getType(),
      duration: scraperClass.prototype.getDuration(),
    });
  }

  return combinations;
}

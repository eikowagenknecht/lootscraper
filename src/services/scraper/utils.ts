import { config } from "@/services/config";
import type {
  OfferDuration,
  OfferPlatform,
  OfferSource,
  OfferType,
} from "@/types/basic";
import type { Config } from "@/types/config";
import type { CronConfig } from "./base/scraper";
import {
  AmazonGamesScraper,
  AmazonLootScraper,
  AppAggGamesScraper,
  AppRavenGamesScraper,
  AppSlicedGamesScraper,
  EpicGamesApiScraper,
  EpicGamesWebScraper,
  EpicMobileAndroidSraper,
  EpicMobileIosSraper,
  GogGamesAlwaysFreeScraper,
  GogGamesScraper,
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
  platform: OfferPlatform;
}

interface ScraperSchedule {
  name: string;
  schedule: CronConfig[];
}

export const allScrapers = [
  AmazonGamesScraper,
  AmazonLootScraper,
  AppSlicedGamesScraper,
  AppRavenGamesScraper,
  EpicGamesWebScraper,
  EpicGamesApiScraper,
  EpicMobileAndroidSraper,
  EpicMobileIosSraper,
  GogGamesScraper,
  GogGamesAlwaysFreeScraper,
  AppAggGamesScraper,
  HumbleGamesScraper,
  ItchGamesScraper,
  SteamGamesScraper,
  SteamLootScraper,
  UbisoftGamesScraper,
];

export type ScraperClass =
  | typeof AmazonGamesScraper
  | typeof AmazonLootScraper
  | typeof AppSlicedGamesScraper
  | typeof AppRavenGamesScraper
  | typeof EpicGamesWebScraper
  | typeof EpicGamesApiScraper
  | typeof EpicMobileAndroidSraper
  | typeof EpicMobileIosSraper
  | typeof GogGamesScraper
  | typeof GogGamesAlwaysFreeScraper
  | typeof AppAggGamesScraper
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

  const seen = new Set<string>();
  for (const scraperClass of enabledScraperClasses) {
    const combination = {
      source: scraperClass.prototype.getSource(),
      type: scraperClass.prototype.getType(),
      duration: scraperClass.prototype.getDuration(),
      platform: scraperClass.prototype.getPlatform(),
    };
    const key = `${combination.source}-${combination.type}-${combination.duration}-${combination.platform}`;
    if (!seen.has(key)) {
      seen.add(key);
      combinations.push(combination);
    }
  }

  return combinations;
}

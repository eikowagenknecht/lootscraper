export { AppleGamesScraper } from "./implementations/apple";
export { AmazonGamesScraper } from "./implementations/amazon/games";
export { AmazonLootScraper } from "./implementations/amazon/loot";
export { EpicGamesScraper } from "./implementations/epic";
export { GoogleGamesScraper } from "./implementations/google";
export { HumbleGamesScraper } from "./implementations/humble";
export { SteamGamesScraper } from "./implementations/steam/games";
export { SteamLootScraper } from "./implementations/steam/loot";
export { UbisoftGamesScraper } from "./implementations/ubisoft";
export { GogGamesScraper } from "./implementations/gog/games";
export { GogGamesAlwaysFreeScraper } from "./implementations/gog/alwaysfree";

// Export types
export type { OfferHandler, RawOffer } from "./base/scraper";
export { Category } from "./base/scraper";

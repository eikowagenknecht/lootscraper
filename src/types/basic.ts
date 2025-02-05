/**
 * Categories for different types of offers.
 * @enum {string}
 * @readonly
 * @property {string} VALID - Represents a valid offer
 * @property {string} CHEAP - Represents a discounted or cheap offer
 * @property {string} DEMO - Represents a demo offer
 * @property {string} PRERELEASE - Represents a prerelease offer
 */
export enum OfferCategory {
  VALID = "VALID",
  CHEAP = "CHEAP",
  DEMO = "DEMO",
  PRERELEASE = "PRERELEASE",
}

/**
 * Enum representing different sources/platforms for game offers.
 * @enum {string}
 * @readonly
 * @description Contains major gaming platforms and digital stores where games can be offered
 * @property {string} STEAM - Valve's Steam platform
 * @property {string} EPIC - Epic Games Store
 * @property {string} GOG - CD Projekt's Good Old Games platform
 * @property {string} AMAZON - Amazon Gaming
 * @property {string} HUMBLE - Humble Bundle store
 * @property {string} ITCH - itch.io indie game platform
 * @property {string} UBISOFT - Ubisoft Connect/Store
 * @property {string} APPLE - Apple App Store
 * @property {string} GOOGLE - Google Play Store
 */
export enum OfferSource {
  STEAM = "STEAM",
  EPIC = "EPIC",
  GOG = "GOG",
  AMAZON = "AMAZON",
  HUMBLE = "HUMBLE",
  ITCH = "ITCH",
  UBISOFT = "UBISOFT",
  APPLE = "APPLE",
  GOOGLE = "GOOGLE",
}

/**
 * Enum representing different sources/platforms for game information.
 * @enum {string}
 * @readonly
 * @description Contains major gaming platforms where game information can be scraped from
 * @property {string} STEAM - Valve's Steam platform
 * @property {string} IGDB - Internet Game Database
 */
export enum InfoSource {
  STEAM = "STEAM",
  IGDB = "IGDB",
}

/**
 * Represents the type of offer available in the system.
 * @enum {string}
 * @readonly
 * @property {string} GAME - Indicates the offer is a game.
 * @property {string} LOOT - Indicates the offer is a loot item, like DLC, Ingame currency, etc.
 */
export enum OfferType {
  GAME = "GAME",
  LOOT = "LOOT",
}

/**
 * Represents the duration type of an offer.
 * @enum {string}
 * @readonly
 * @property {string} CLAIMABLE - Indicates the offer can be claimed once. These are the usual offers (Epic etc.)
 * @property {string} ALWAYS - Indicates the offer is permanently available.
 * @property {string} TEMPORARY - Indicates the offer is available for a limited time (Steam weekend, etc.)
 */
export enum OfferDuration {
  CLAIMABLE = "CLAIMABLE",
  ALWAYS = "ALWAYS",
  TEMPORARY = "TEMPORARY",
}

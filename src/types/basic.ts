/**
 * Categories for different types of offers.
 * VALID - Represents a valid offer
 * CHEAP - Represents a discounted or cheap offer
 * DEMO - Represents a demo offer
 * PRERELEASE - Represents a prerelease offer
 */
export enum OfferCategory {
  VALID = "VALID",
  CHEAP = "CHEAP",
  DEMO = "DEMO",
  PRERELEASE = "PRERELEASE",
}

/**
 * Enum representing different sources/platforms for game offers.
 * @description Contains major gaming platforms and digital stores where games can be offered
 * STEAM - Valve's Steam platform
 * EPIC - Epic Games Store
 * GOG - CD Projekt's Good Old Games platform
 * AMAZON - Amazon Gaming
 * HUMBLE - Humble Bundle store
 * ITCH - itch.io indie game platform
 * UBISOFT - Ubisoft Connect/Store
 * APPLE - Apple App Store
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
 * @description Contains major gaming platforms where game information can be scraped from
 * STEAM - Valve's Steam platform
 * IGDB - Internet Game Database
 */
export enum InfoSource {
  STEAM = "STEAM",
  IGDB = "IGDB",
}

/**
 * Represents the type of offer available in the system.
 * GAME - Indicates the offer is a game.
 * LOOT - Indicates the offer is a loot item, like DLC, Ingame currency, etc.
 */
export enum OfferType {
  GAME = "GAME",
  LOOT = "LOOT",
}

/**
 * Represents the duration type of an offer.
 * CLAIMABLE - Indicates the offer can be claimed once. These are the usual offers (Epic etc.)
 * ALWAYS - Indicates the offer is permanently available.
 * TEMPORARY - Indicates the offer is available for a limited time (Steam weekend, etc.)
 */
export enum OfferDuration {
  CLAIMABLE = "CLAIMABLE",
  ALWAYS = "ALWAYS",
  TEMPORARY = "TEMPORARY",
}

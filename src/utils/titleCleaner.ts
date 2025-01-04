export function cleanGameTitle(title: string): string {
  return title
    .replace(/\n/g, "")
    .replace(/ - /g, ": ")
    .replace(/ : /g, ": ")
    .trim()
    .replace(/^(\[VIP]|\[ VIP ])/g, "")
    .replace(/ on Origin$/g, "")
    .replace(/ Game of the Year Edition Deluxe$/g, "")
    .replace(/ Game of the Year Edition$/g, "")
    .replace(/ Definitive Edition$/g, "")
    .replace(/ Deluxe Edition$/g, "")
    .replace(/ \(Mobile\)$/g, "")
    .trim()
    .replace(/[:|-]$/g, "")
    .trim();
}

export function cleanLootTitle(title: string): string {
  return title
    .replace(/\n/g, "")
    .replace(/ - /g, ": ")
    .replace(/ : /g, ": ")
    .trim()
    .replace(/[:|-]$/g, "")
    .trim();
}

/**
 * Clean the combined title.
 *
 * Unfortunately loot offers come in free text format, so we need to do some
 * manual matching.
 *
 * Most of the time, it is the part before the first ": ", e.g.
 *   "Lords Mobile: Warlord Pack"
 *   -> "Lords Mobile"
 *
 * When the title itself contains a ": ", it can also be the second, e.g.
 *   "Mobile Legends: Bang Bang: Amazon Prime Chest"
 *   -> Mobile Legends: Bang Bang
 *
 * Sometimes it also ist "Get ... in [Game]", e.g.
 *   "Get up to GTA$400,000 this month in GTA Online"
 *   -> GTA Online
 *
 * We use the same method for Steam loot offers for now as they also seem to
 * be seperated in the same fashion.
 *
 * Sometimes Steam uses " — " (warning: this is a special unicode character)
 * for the separation of game and loot name and the loot itself also
 * contains a ": ". In this case, we can just use the part before the " — "
 * as the game name, e.g.
 *   "World of Warships — Starter Pack: Dreadnought"
 *   -> World of Warships: Starter Pack
 *
 * So as a general rule, we try splitting in this order:
 * 1. Special Steam format (TITLE — LOOT: LOOTDETAIL)
 * 2. By the second colon (TITLE: TITLEDETAIL: LOOTDETAIL)
 * 3. By the "Get ... in [Game] pattern" (to catch games with a colon in the name)
 * 4. By the ": " pattern (TITLE: LOOT)
 *
 * @param title The combined title as seen in the offer
 * @returns Both the probable game name and the resulting offer title
 */
export function cleanCombinedTitle(title: string): [string, string] {
  let probableGameName = "";
  let probableLootName = "";

  // Clean up input
  const cleanTitle = title.replace(/\n/g, " ").trim();

  // Special Steam format (TITLE — LOOT: LOOTDETAIL)
  const specialMatch = /^(.*) — (.*: .*)$/.exec(cleanTitle);
  if (specialMatch?.[1]) {
    probableGameName = specialMatch[1];
    probableLootName = specialMatch[2];
  }

  if (!probableGameName) {
    // Replace some very special characters that Steam uses sometimes
    const normalizedTitle = cleanTitle
      .replace(/：/g, ": ")
      .replace(/ — /g, ": ")
      .replace(/ - /g, ": ");

    const titleParts = normalizedTitle.split(": ");

    // By the second colon (TITLE: TITLEDETAIL: LOOTDETAIL)
    if (titleParts.length >= 3) {
      probableGameName = titleParts.slice(0, -1).join(": ");
      probableLootName = titleParts[titleParts.length - 1];
    }

    // By the "Get ... in [Game] pattern" (to catch games with a colon in the name)
    if (!probableGameName) {
      const getInMatch = /^Get (.*) in (.*)$/.exec(cleanTitle);
      if (getInMatch?.[1]) {
        probableGameName = getInMatch[2];
        probableLootName = getInMatch[1];
      }
    }

    // By the ": " pattern (TITLE: LOOT)
    if (!probableGameName && titleParts.length === 2) {
      probableGameName = titleParts[0];
      probableLootName = titleParts[1];
    }

    // If we still don't have a game name, we just use the whole title
    if (!probableGameName) {
      probableGameName = cleanTitle;
    }
  }

  // Clean game name
  probableGameName = cleanGameTitle(probableGameName);

  // Capitalize first letter of loot name
  probableLootName = probableLootName.trim();
  if (probableLootName) {
    probableLootName =
      probableLootName.charAt(0).toUpperCase() + probableLootName.slice(1);
  }

  // Construct final title
  const resultingOfferTitle = probableLootName
    ? `${probableGameName} - ${probableLootName}`
    : probableGameName;

  return [probableGameName, resultingOfferTitle];
}

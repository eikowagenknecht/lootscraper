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
    // Replace special characters
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
    // By the "Get ... in [Game] pattern"
    else {
      const getInMatch = /^Get (.*) in (.*)$/.exec(cleanTitle);
      if (getInMatch?.[1]) {
        probableGameName = getInMatch[2];
        probableLootName = getInMatch[1];
      }
      // By the ": " pattern (TITLE: LOOT)
      else if (titleParts.length === 2) {
        probableGameName = titleParts[0];
        probableLootName = titleParts[1];
      }
      // Default to full title
      else {
        probableGameName = cleanTitle;
      }
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

import { describe, test } from "vitest";
import { cleanCombinedTitle, cleanGameTitle } from "./titleCleaner";

describe.concurrent("Title Cleaner", () => {
  test("should keep registered trademark in title", ({ expect }) => {
    const title = "Tom Clancy's Rainbow Six® Siege";
    const cleaned = "Tom Clancy's Rainbow Six® Siege";

    expect(cleanGameTitle(title)).toBe(cleaned);
  });

  test("should handle simple game and pack title", ({ expect }) => {
    const title = "Lords Mobile: Warlord Pack";
    const [cleanedGame, cleanedOffer] = cleanCombinedTitle(title);

    expect(cleanedGame).toBe("Lords Mobile");
    expect(cleanedOffer).toBe("Lords Mobile - Warlord Pack");
  });

  test("should handle title with multiple colons", ({ expect }) => {
    const title = "Mobile Legends: Bang Bang: Amazon Prime Chest";
    const [cleanedGame, cleanedOffer] = cleanCombinedTitle(title);

    expect(cleanedGame).toBe("Mobile Legends: Bang Bang");
    expect(cleanedOffer).toBe("Mobile Legends: Bang Bang - Amazon Prime Chest");
  });

  test("should handle special GTA Online format", ({ expect }) => {
    const title = "Get up to GTA$400,000 this month in GTA Online";
    const [cleanedGame, cleanedOffer] = cleanCombinedTitle(title);

    expect(cleanedGame).toBe("GTA Online");
    expect(cleanedOffer).toBe("GTA Online - Up to GTA$400,000 this month");
  });

  test("should handle em dash in title", ({ expect }) => {
    const title = "World of Warships — Starter Pack: Dreadnought";
    const [cleanedGame, cleanedOffer] = cleanCombinedTitle(title);

    expect(cleanedGame).toBe("World of Warships");
    expect(cleanedOffer).toBe("World of Warships - Starter Pack: Dreadnought");
  });

  test("should remove whitespace and newlines from game title", ({
    expect,
  }) => {
    const title = "\n        Vambrace: Cold Soul\n    ";
    const cleaned = "Vambrace: Cold Soul";

    expect(cleanGameTitle(title)).toBe(cleaned);
  });
});

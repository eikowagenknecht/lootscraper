import { translationService } from "@/services/translation";
import { OfferDuration, OfferPlatform, OfferSource, OfferType } from "@/types";
import { beforeAll, describe, expect, test } from "vitest";
import {
  cleanCombinedTitle,
  cleanGameTitle,
  generateFeedTitle,
  generateFilename,
  getMatchScore,
} from "./stringTools";

beforeAll(async () => {
  await translationService.initialize();
});

describe.concurrent("getMatchScore", () => {
  interface TestCase {
    search: string;
    result: string;
    expectedScore: number;
    description: string;
    approximateMatch?: boolean;
  }

  const testCases: TestCase[] = [
    {
      search: "hello world",
      result: "hello world",
      expectedScore: 1.0,
      description: "exact match",
    },
    {
      search: "Hello World!",
      result: "hello world",
      expectedScore: 1.0,
      description: "case and punctuation insensitive match",
    },
    {
      search: "hello",
      result: "hello world",
      expectedScore: 0.99,
      description: "partial match at start with penalty",
      approximateMatch: true,
    },
    {
      search: "world",
      result: "hello world",
      expectedScore: 0.99,
      description: "partial match at end with penalty",
      approximateMatch: true,
    },
    {
      search: "helo world",
      result: "hello world",
      expectedScore: 0.91,
      description: "slight misspelling",
      approximateMatch: true,
    },
    {
      search: "completely different",
      result: "hello world",
      expectedScore: 0.19,
      description: "no meaningful match",
      approximateMatch: true,
    },
    {
      search: "",
      result: "hello world",
      expectedScore: 0,
      description: "empty search string",
    },
    {
      search: "hello world",
      result: "",
      expectedScore: 0,
      description: "empty result string",
    },
    {
      search: "",
      result: "",
      expectedScore: 1.0,
      description: "both strings empty",
    },
    {
      search: "hello   world",
      result: "hello world",
      expectedScore: 1.0,
      description: "multiple spaces are condensed",
    },
    {
      search: "Rainbow Six Siege",
      result: "Tom Clancy's Rainbow Six® Siege",
      expectedScore: 0.99,
      description: "game title with trademark and prefix",
      approximateMatch: true,
    },
    {
      search: "Fall Guys",
      result: "Fall Guy",
      expectedScore: 0.89,
      description: "similar game title with plural difference",
      approximateMatch: true,
    },
  ];

  for (const {
    search,
    result,
    expectedScore,
    description,
    approximateMatch,
  } of testCases) {
    test(`should handle ${description}`, ({ expect }) => {
      const score = getMatchScore(search, result);

      if (approximateMatch) {
        expect(score).toBeCloseTo(expectedScore, 2);
      } else {
        expect(score).toBe(expectedScore);
      }
    });
  }

  test("should handle special characters", ({ expect }) => {
    const search = "hello@world!";
    const result = "hello#world?";
    const score = getMatchScore(search, result);

    expect(score).toBe(1.0);
  });

  test("should find Rainbow Six Siege similar to full title", ({ expect }) => {
    const search = "Rainbow Six Siege";
    const result = "Tom Clancy's Rainbow Six® Siege";

    const score = getMatchScore(search, result);
    expect(score).toBe(0.99);
  });

  test("should find Fall Guys not too similar to Fall Guy", ({ expect }) => {
    const search = "Fall Guys";
    const result = "Fall Guy";

    const score = getMatchScore(search, result);
    expect(score).toBeLessThan(0.99);
  });
});

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

  test("should handle dashed game title", ({ expect }) => {
    const title = "Aces of the Luftwaffe - Squadron Extended Edition";
    const cleanedGame = cleanGameTitle(title);

    expect(cleanedGame).toBe(
      "Aces of the Luftwaffe: Squadron Extended Edition",
    );
  });

  test("should handle colon spaced game title", ({ expect }) => {
    const title = "My City : Hospital";
    const cleanedGame = cleanGameTitle(title);

    expect(cleanedGame).toBe("My City: Hospital");
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

describe("generateFilename", () => {
  const baseOptions = {
    prefix: "lootscraper",
    extension: "xml",
  };

  test("should generate basic filename with just prefix", () => {
    expect(generateFilename(baseOptions)).toBe("lootscraper.xml");
  });

  test("should include all flag when true", () => {
    expect(
      generateFilename({
        ...baseOptions,
        withHistory: true,
      }),
    ).toBe("lootscraper_all.xml");
  });

  test("should combine all options in correct order", () => {
    expect(
      generateFilename({
        ...baseOptions,
        combination: {
          source: OfferSource.EPIC,
          type: OfferType.GAME,
          duration: OfferDuration.TEMPORARY,
          platform: OfferPlatform.PC,
        },
        withHistory: true,
      }),
    ).toBe("lootscraper_epic_game_temporary_all.xml");
  });
});

describe("generateFeedTitle", () => {
  test("should return default title when no options provided", () => {
    expect(generateFeedTitle()).toBe("Free Games and Loot");
  });

  test("should combine all options in correct order", () => {
    expect(
      generateFeedTitle({
        source: OfferSource.EPIC,
        type: OfferType.GAME,
        duration: OfferDuration.TEMPORARY,
        platform: OfferPlatform.PC,
      }),
    ).toBe("Free Epic Games Games (Temporary)");
  });
});

import { beforeAll, describe, expect, test, vi } from "vitest";

import { translationService } from "@/services/translation";
import { OfferDuration, OfferPlatform, OfferSource, OfferType } from "@/types/basic";
import type { Config } from "@/types/config";
import type { Offer } from "@/types/database";

import { RssGenerator } from "./rss";

vi.mock("node:fs/promises", () => ({ writeFile: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/utils/path", () => ({ getDataPath: vi.fn().mockReturnValue("/tmp") }));
vi.mock("@/services/database/gameRepository", () => ({
  getGameWithInfo: vi.fn().mockResolvedValue(null),
}));

beforeAll(async () => {
  await translationService.initialize();
});

const testConfig = {
  feed: {
    idPrefix: "https://test.example.com/",
    urlAlternate: "https://example.com/loot",
    urlPrefix: "https://feed.example.com/",
    authorName: "Test",
    authorEmail: "test@example.com",
    authorWeb: "https://example.com",
  },
  common: { feedFilePrefix: "lootscraper" },
} as unknown as Config;

function makeOffer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: 1,
    source: OfferSource.EPIC,
    type: OfferType.GAME,
    duration: OfferDuration.CLAIMABLE,
    platform: OfferPlatform.PC,
    title: "Test Game",
    probable_game_name: "Test Game",
    seen_first: "2026-01-01T00:00:00.000Z",
    seen_last: "2026-01-02T00:00:00.000Z",
    valid_from: "2026-01-01T00:00:00.000Z",
    valid_to: "2026-01-10T00:00:00.000Z",
    rawtext: { title: "Test Game" },
    url: "https://example.com/game",
    img_url: null,
    game_id: null,
    category: "VALID",
    ...overrides,
  } as unknown as Offer;
}

describe("RssGenerator.getEntryTitle", () => {
  function getTitle(offer: Offer): string {
    const gen = new RssGenerator(testConfig);
    return (gen as any).getEntryTitle(offer) as string;
  }

  test("PC game includes platform in title", () => {
    const offer = makeOffer({ source: OfferSource.STEAM, platform: OfferPlatform.PC });
    expect(getTitle(offer)).toBe("Steam (Game, PC) - Test Game");
  });

  test("Android game includes platform in title", () => {
    const offer = makeOffer({ source: OfferSource.EPIC, platform: OfferPlatform.ANDROID });
    expect(getTitle(offer)).toBe("Epic Games (Game, Android) - Test Game");
  });

  test("iOS game includes platform in title", () => {
    const offer = makeOffer({ source: OfferSource.EPIC, platform: OfferPlatform.IOS });
    expect(getTitle(offer)).toBe("Epic Games (Game, iOS) - Test Game");
  });

  test("non-claimable offer appends duration after platform", () => {
    const offer = makeOffer({
      source: OfferSource.STEAM,
      platform: OfferPlatform.PC,
      duration: OfferDuration.ALWAYS,
    });
    expect(getTitle(offer)).toBe("Steam (Game, PC, Always Free) - Test Game");
  });

  test("loot type is included correctly", () => {
    const offer = makeOffer({
      source: OfferSource.AMAZON,
      type: OfferType.LOOT,
      platform: OfferPlatform.PC,
    });
    expect(getTitle(offer)).toBe("Amazon Prime (Loot, PC) - Test Game");
  });
});

describe("RssGenerator category metadata", () => {
  test("entry includes source, platform, and type category elements", async () => {
    const gen = new RssGenerator(testConfig);
    const feedGen = (gen as any).feedGenerator;
    const addEntrySpy = vi.spyOn(feedGen, "addEntry");

    const offer = makeOffer({
      source: OfferSource.EPIC,
      platform: OfferPlatform.ANDROID,
      type: OfferType.GAME,
    });

    await gen.generateFeed([offer]);

    expect(addEntrySpy).toHaveBeenCalledOnce();
    const categories: { term: string; scheme: string; label: string }[] =
      addEntrySpy.mock.calls[0][0].category;

    expect(categories).toContainEqual({
      term: "source:EPIC",
      scheme: "https://feed.eikowagenknecht.com/lootscraper/source",
      label: "Epic Games",
    });
    expect(categories).toContainEqual({
      term: "platform:ANDROID",
      scheme: "https://feed.eikowagenknecht.com/lootscraper/platform",
      label: "Android",
    });
    expect(categories).toContainEqual({
      term: "type:GAME",
      scheme: "https://feed.eikowagenknecht.com/lootscraper/type",
      label: "Game",
    });
  });

  test("metadata categories appear before genre categories", async () => {
    const gen = new RssGenerator(testConfig);
    const feedGen = (gen as any).feedGenerator;
    const addEntrySpy = vi.spyOn(feedGen, "addEntry");

    const offer = makeOffer({
      source: OfferSource.STEAM,
      platform: OfferPlatform.PC,
      type: OfferType.GAME,
    });

    await gen.generateFeed([offer]);

    const categories: { term: string; scheme: string }[] =
      addEntrySpy.mock.calls[0][0].category;

    const sourceIdx = categories.findIndex((c) => c.term === "source:STEAM");
    const firstGenreIdx = categories.findIndex((c) =>
      c.scheme.includes("steampowered.com"),
    );

    if (firstGenreIdx !== -1) {
      expect(sourceIdx).toBeLessThan(firstGenreIdx);
    }
    expect(sourceIdx).toBeGreaterThanOrEqual(0);
  });

  test("PC offer has platform:PC category", async () => {
    const gen = new RssGenerator(testConfig);
    const feedGen = (gen as any).feedGenerator;
    const addEntrySpy = vi.spyOn(feedGen, "addEntry");

    await gen.generateFeed([makeOffer({ platform: OfferPlatform.PC })]);

    const categories: { term: string }[] = addEntrySpy.mock.calls[0][0].category;
    expect(categories.map((c) => c.term)).toContain("platform:PC");
  });
});

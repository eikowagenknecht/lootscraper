import { readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

import { DateTime } from "luxon";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import { config } from "@/services/config";
import { databaseService } from "@/services/database";
import { createGame } from "@/services/database/gameRepository";
import { createIgdbInfo } from "@/services/database/igdbInfoRepository";
import { createOffer } from "@/services/database/offerRepository";
import { createSteamInfo } from "@/services/database/steamInfoRepository";
import type { FeedCombination } from "@/services/scraper/utils";
import { translationService } from "@/services/translation";
import { OfferDuration, OfferPlatform, OfferSource, OfferType } from "@/types/basic";
import type { Config } from "@/types/config";
import type { NewIgdbInfo, NewOffer, NewSteamInfo, Offer } from "@/types/database";
import { getDataPath } from "@/utils/path";
import { generateFilename } from "@/utils/stringTools";

import { RssGenerator } from "./rss";

beforeAll(async () => {
  await translationService.initialize();
});

let writtenFiles: string[] = [];

beforeEach(async () => {
  config.loadConfig();
  await databaseService.initialize(config.get(), true);
  writtenFiles = [];
});

afterEach(async () => {
  await databaseService.destroy();
  for (const filePath of writtenFiles) {
    rmSync(filePath, { force: true });
  }
});

async function insertOffer(overrides: Partial<Omit<Offer, "id">> = {}): Promise<Offer> {
  const now = DateTime.now().toISO();
  const offerFields: Omit<Offer, "id"> = {
    source: OfferSource.EPIC,
    type: OfferType.GAME,
    duration: OfferDuration.CLAIMABLE,
    platform: OfferPlatform.PC,
    title: "Test Game",
    probable_game_name: "Test Game",
    seen_first: now,
    seen_last: now,
    valid_from: now,
    valid_to: null,
    rawtext: { title: "Test Game" },
    url: "https://example.com/game",
    img_url: null,
    game_id: null,
    category: "VALID",
    ...overrides,
  };

  const newOffer: NewOffer = { ...offerFields, rawtext: JSON.stringify(offerFields.rawtext) };
  const id = await createOffer(newOffer);
  return { ...offerFields, id };
}

async function insertSteamGame(
  overrides: { steamInfo?: Partial<NewSteamInfo>; igdbInfo?: Partial<NewIgdbInfo> } = {},
): Promise<number> {
  let steamId: number | null = null;
  let igdbId: number | null = null;

  if (overrides.steamInfo) {
    const steamInfo: NewSteamInfo = {
      id: 1,
      url: "https://store.steampowered.com/app/1",
      name: "Test Game",
      short_description: null,
      release_date: null,
      genres: null,
      publishers: null,
      image_url: null,
      recommendations: null,
      percent: null,
      score: null,
      metacritic_score: null,
      metacritic_url: null,
      recommended_price_eur: null,
      ...overrides.steamInfo,
    };
    steamId = await createSteamInfo(steamInfo);
  }

  if (overrides.igdbInfo) {
    const igdbInfo: NewIgdbInfo = {
      id: 1,
      url: "https://igdb.com/games/test-game",
      name: "Test Game",
      short_description: null,
      release_date: null,
      user_score: null,
      user_ratings: null,
      meta_score: null,
      meta_ratings: null,
      ...overrides.igdbInfo,
    };
    igdbId = await createIgdbInfo(igdbInfo);
  }

  return createGame({ steam_id: steamId, igdb_id: igdbId });
}

async function generateAndRead(
  testConfig: Config,
  offers: Offer[],
  combination?: FeedCombination,
): Promise<string> {
  const gen = new RssGenerator(testConfig, combination);
  await gen.generateFeed(offers);

  const filename = generateFilename({
    prefix: testConfig.common.feedFilePrefix,
    extension: "xml",
    ...(combination && { combination }),
  });
  const filePath = resolve(getDataPath(), filename);
  writtenFiles.push(filePath);

  return readFileSync(filePath, "utf8");
}

describe("RssGenerator", () => {
  test("generateFeed writes a feed file containing the offer title", async () => {
    const testConfig = config.get();
    const offer = await insertOffer({ title: "Smoke Test Game" });

    const xml = await generateAndRead(testConfig, [offer]);

    expect(xml).toContain("Smoke Test Game");
  });
});

describe("RssGenerator entry titles", () => {
  test("PC game title includes platform", async () => {
    const testConfig = config.get();
    const offer = await insertOffer({
      source: OfferSource.STEAM,
      platform: OfferPlatform.PC,
      title: "Portal 2",
    });

    const xml = await generateAndRead(testConfig, [offer]);

    expect(xml).toContain("<title>Steam (Game, PC) - Portal 2</title>");
  });

  test("Android game title includes platform", async () => {
    const testConfig = config.get();
    const offer = await insertOffer({
      source: OfferSource.EPIC,
      platform: OfferPlatform.ANDROID,
      title: "Mobile Game",
    });

    const xml = await generateAndRead(testConfig, [offer]);

    expect(xml).toContain("<title>Epic Games (Game, Android) - Mobile Game</title>");
  });

  test("iOS game title includes platform", async () => {
    const testConfig = config.get();
    const offer = await insertOffer({
      source: OfferSource.EPIC,
      platform: OfferPlatform.IOS,
      title: "iOS Game",
    });

    const xml = await generateAndRead(testConfig, [offer]);

    expect(xml).toContain("<title>Epic Games (Game, iOS) - iOS Game</title>");
  });

  test("non-claimable duration is appended after platform", async () => {
    const testConfig = config.get();
    const offer = await insertOffer({
      source: OfferSource.STEAM,
      platform: OfferPlatform.PC,
      duration: OfferDuration.ALWAYS,
      title: "Team Fortress 2",
    });

    const xml = await generateAndRead(testConfig, [offer]);

    expect(xml).toContain("<title>Steam (Game, PC, Always Free) - Team Fortress 2</title>");
  });

  test("claimable duration is not appended", async () => {
    const testConfig = config.get();
    const offer = await insertOffer({
      source: OfferSource.STEAM,
      platform: OfferPlatform.PC,
      duration: OfferDuration.CLAIMABLE,
      title: "Half-Life 2",
    });

    const xml = await generateAndRead(testConfig, [offer]);

    expect(xml).toContain("<title>Steam (Game, PC) - Half-Life 2</title>");
  });

  test("loot type is included correctly", async () => {
    const testConfig = config.get();
    const offer = await insertOffer({
      source: OfferSource.AMAZON,
      type: OfferType.LOOT,
      platform: OfferPlatform.PC,
      title: "Prime Loot Pack",
    });

    const xml = await generateAndRead(testConfig, [offer]);

    expect(xml).toContain("<title>Amazon Prime (Loot, PC) - Prime Loot Pack</title>");
  });
});

describe("RssGenerator category metadata", () => {
  test("entry includes source, platform, and type categories", async () => {
    const testConfig = config.get();
    const offer = await insertOffer({
      source: OfferSource.EPIC,
      platform: OfferPlatform.ANDROID,
      type: OfferType.GAME,
    });

    const xml = await generateAndRead(testConfig, [offer]);

    expect(xml).toContain(
      `<category term="source:EPIC" scheme="${testConfig.feed.idPrefix}source" label="Epic Games"/>`,
    );
    expect(xml).toContain(
      `<category term="platform:ANDROID" scheme="${testConfig.feed.idPrefix}platform" label="Android"/>`,
    );
    expect(xml).toContain(
      `<category term="type:GAME" scheme="${testConfig.feed.idPrefix}type" label="Game"/>`,
    );
  });

  test("metadata categories appear before genre categories", async () => {
    const testConfig = config.get();
    const gameId = await insertSteamGame({
      steamInfo: { genres: "Action, Strategy" },
    });
    const offer = await insertOffer({
      source: OfferSource.STEAM,
      platform: OfferPlatform.PC,
      game_id: gameId,
    });

    const xml = await generateAndRead(testConfig, [offer]);

    const sourceIndex = xml.indexOf('<category term="source:STEAM"');
    const genreIndex = xml.indexOf('<category term="Genre: Action"');

    expect(sourceIndex).toBeGreaterThanOrEqual(0);
    expect(genreIndex).toBeGreaterThan(sourceIndex);
  });

  test("each genre in the comma-separated list becomes its own category", async () => {
    const testConfig = config.get();
    const gameId = await insertSteamGame({
      steamInfo: { genres: "Action, Strategy" },
    });
    const offer = await insertOffer({ game_id: gameId });

    const xml = await generateAndRead(testConfig, [offer]);

    expect(xml).toContain(
      '<category term="Genre: Action" scheme="https://store.steampowered.com/category/" label="Action"/>',
    );
    expect(xml).toContain(
      '<category term="Genre: Strategy" scheme="https://store.steampowered.com/category/" label="Strategy"/>',
    );
  });

  test("offer without a linked game has no genre categories", async () => {
    const testConfig = config.get();
    const offer = await insertOffer({ game_id: null });

    const xml = await generateAndRead(testConfig, [offer]);

    expect(xml).not.toContain('<category term="Genre:');
  });
});

describe("RssGenerator content body", () => {
  test("image URL is HTML-escaped", async () => {
    const testConfig = config.get();
    const offer = await insertOffer({
      img_url: "https://example.com/img?a=1&b=2",
    });

    const xml = await generateAndRead(testConfig, [offer]);

    expect(xml).toContain('<img src="https://example.com/img?a=1&amp;b=2" />');
  });

  test("falls back to Steam image when offer has no image", async () => {
    const testConfig = config.get();
    const gameId = await insertSteamGame({
      steamInfo: { image_url: "https://cdn.example.com/steam.jpg" },
    });
    const offer = await insertOffer({ img_url: null, game_id: gameId });

    const xml = await generateAndRead(testConfig, [offer]);

    expect(xml).toContain('<img src="https://cdn.example.com/steam.jpg" />');
  });

  test("ratings block includes Metacritic, Steam, and IGDB sources", async () => {
    const testConfig = config.get();
    const gameId = await insertSteamGame({
      steamInfo: {
        metacritic_score: 85,
        metacritic_url: "https://example.com/metacritic",
        percent: 90,
        score: 8,
        recommendations: 1000,
        url: "https://store.steampowered.com/app/1",
      },
      igdbInfo: {
        meta_score: 88,
        meta_ratings: 50,
        user_score: 91,
        user_ratings: 200,
        url: "https://igdb.com/games/test-game",
      },
    });
    const offer = await insertOffer({ game_id: gameId });

    const xml = await generateAndRead(testConfig, [offer]);

    expect(xml).toContain(
      '<li><b>Ratings:</b> <a href="https://example.com/metacritic">Metacritic 85%</a> / ' +
        '<a href="https://store.steampowered.com/app/1">Steam 90% (8/10, 1000 recommendations)</a> / ' +
        '<a href="https://igdb.com/games/test-game">IGDB Meta 88% (50 sources)</a> / ' +
        '<a href="https://igdb.com/games/test-game">IGDB User 91% (200 sources)</a></li>',
    );
  });

  test("release date prefers IGDB info over Steam info", async () => {
    const testConfig = config.get();
    const gameId = await insertSteamGame({
      steamInfo: { release_date: "2019-01-01T00:00:00.000Z" },
      igdbInfo: { release_date: "2020-06-15T00:00:00.000Z" },
    });
    const offer = await insertOffer({ game_id: gameId });

    const xml = await generateAndRead(testConfig, [offer]);

    expect(xml).toContain("<li><b>Release date:</b> 2020-06-15</li>");
  });

  test("recommended Steam price is rendered", async () => {
    const testConfig = config.get();
    const gameId = await insertSteamGame({
      steamInfo: { recommended_price_eur: 19.99 },
    });
    const offer = await insertOffer({ game_id: gameId });

    const xml = await generateAndRead(testConfig, [offer]);

    expect(xml).toContain("<li><b>Recommended price (Steam):</b> 19.99 EUR</li>");
  });

  test("description is HTML-escaped", async () => {
    const testConfig = config.get();
    const gameId = await insertSteamGame({
      igdbInfo: { short_description: "Play <b>now</b> & save!" },
    });
    const offer = await insertOffer({ game_id: gameId });

    const xml = await generateAndRead(testConfig, [offer]);

    expect(xml).toContain("<li><b>Description:</b> Play &lt;b&gt;now&lt;/b&gt; &amp; save!</li>");
  });
});

describe("RssGenerator filename and feed id", () => {
  test("default (no combination) feed writes to the bare prefix filename", async () => {
    const testConfig = config.get();
    const offer = await insertOffer();

    await generateAndRead(testConfig, [offer]);

    const expectedPath = resolve(getDataPath(), `${testConfig.common.feedFilePrefix}.xml`);
    expect(writtenFiles).toContain(expectedPath);
    expect(() => readFileSync(expectedPath, "utf8")).not.toThrow();
  });

  test("default feed id is the bare idPrefix", async () => {
    const testConfig = config.get();
    const offer = await insertOffer();

    const xml = await generateAndRead(testConfig, [offer]);

    expect(xml).toContain(`<id>${testConfig.feed.idPrefix}</id>`);
  });

  test("combination feed writes to a source/type-suffixed filename", async () => {
    const testConfig = config.get();
    const offer = await insertOffer({ source: OfferSource.STEAM, type: OfferType.GAME });
    const combination: FeedCombination = {
      source: OfferSource.STEAM,
      type: OfferType.GAME,
      duration: OfferDuration.CLAIMABLE,
      platform: OfferPlatform.PC,
    };

    await generateAndRead(testConfig, [offer], combination);

    const expectedPath = resolve(
      getDataPath(),
      `${testConfig.common.feedFilePrefix}_steam_game.xml`,
    );
    expect(writtenFiles).toContain(expectedPath);
    expect(() => readFileSync(expectedPath, "utf8")).not.toThrow();
  });

  test("combination feed id is derived from the filename's first segment", async () => {
    const testConfig = config.get();
    const offer = await insertOffer({ source: OfferSource.STEAM, type: OfferType.GAME });
    const combination: FeedCombination = {
      source: OfferSource.STEAM,
      type: OfferType.GAME,
      duration: OfferDuration.CLAIMABLE,
      platform: OfferPlatform.PC,
    };

    const xml = await generateAndRead(testConfig, [offer], combination);

    // RssGenerator.getFeedId() splits the filename on "_" with a limit of 2,
    // so only the first segment after the prefix ends up in the feed id -
    // "steam_game.xml" contributes "steam", not the full combination.
    expect(xml).toContain(`<id>${testConfig.feed.idPrefix}steam</id>`);
  });

  test("different combinations produce different filenames", async () => {
    const testConfig = config.get();
    const steamOffer = await insertOffer({ source: OfferSource.STEAM, title: "Steam Offer" });
    const epicOffer = await insertOffer({ source: OfferSource.EPIC, title: "Epic Offer" });

    await generateAndRead(testConfig, [steamOffer], {
      source: OfferSource.STEAM,
      type: OfferType.GAME,
      duration: OfferDuration.CLAIMABLE,
      platform: OfferPlatform.PC,
    });
    await generateAndRead(testConfig, [epicOffer], {
      source: OfferSource.EPIC,
      type: OfferType.GAME,
      duration: OfferDuration.CLAIMABLE,
      platform: OfferPlatform.PC,
    });

    expect(writtenFiles).toHaveLength(2);
    expect(new Set(writtenFiles).size).toBe(2);
  });
});

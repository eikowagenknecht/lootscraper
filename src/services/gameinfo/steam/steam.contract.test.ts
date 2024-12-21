import { browser } from "@/services/browser";
import { config } from "@/services/config";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SteamClient } from "./steam";

describe("Steam Game Info Contract Tests", () => {
  beforeAll(async () => {
    config.loadConfig();
    await browser.initialize(config.get());
  });

  let steam: SteamClient;

  beforeEach(() => {
    steam = new SteamClient(browser.getContext());
  });

  describe("Steam App ID Resolution", () => {
    it("should find Steam ID for LOVE (issue #310)", async () => {
      const expectedId = 269270; // LOVE
      const steamId = await steam.findSteamId("LOVE");
      expect(steamId).toBe(expectedId);
    });

    it("should find Steam ID for Rainbow Six Siege", async () => {
      const expectedId = 359550; // Tom Clancy's Rainbow Six® Siege
      const steamId = await steam.findSteamId("Rainbow Six Siege");
      expect(steamId).toBe(expectedId);
    });

    it("should return null for non-existent game", async () => {
      const steamId = await steam.findSteamId("XXXXXXXXXXXXXXXXXXXXXXXXXXXX");
      expect(steamId).toBeNull();
    });

    it("should handle special characters in game titles", async () => {
      const expectedId = 32460;
      const steamId = await steam.findSteamId(
        "Monkey Island 2 Special Edition: LeChuck’s Revenge",
      );
      expect(steamId).toBe(expectedId);
    });
  });

  describe("Steam Game Details", () => {
    it("should fetch Counter-Strike details", async () => {
      const appId = await steam.findSteamId("Counter-Strike");
      expect(appId).toBeDefined();
      if (!appId) return;
      const info = await steam.getDetails(appId);
      expect(info).toBeDefined();
      expect(info.name).toBe("Counter-Strike");
      expect(info.short_description).toBeDefined();
      expect(info.release_date).toBe("2000-11-01T00:00:00.000Z");
      expect(info.recommended_price_eur).toBe(8.19);
      expect(info.genres).toBe("Action");
      expect(info.recommendations).toBeGreaterThan(100000);
      expect(info.percent).toBeGreaterThan(90);
      expect(info.score).toBe(10);
      expect(info.metacritic_score).toBe(88);
      expect(info.metacritic_url).toBe(
        "https://www.metacritic.com/game/pc/counter-strike?ftag=MCD-06-10aaa1f",
      );
    });

    it("should fetch Rainbow Six Siege details", async () => {
      const appId = await steam.findSteamId("Rainbow Six Siege");
      expect(appId).toBeDefined();
      if (!appId) return;
      const info = await steam.getDetails(appId);
      expect(info).toBeDefined();
      expect(info.name).toBe("Tom Clancy's Rainbow Six® Siege");
      expect(info.short_description).toBeDefined();
      expect(info.release_date).toBe("2015-12-01T00:00:00.000Z");
      expect(info.recommended_price_eur).toBe(19.99);
      expect(info.genres).toBe("Action");
      expect(info.recommendations).toBeGreaterThan(850000);
      expect(info.percent).toBeGreaterThan(80);
      expect(info.score).toBe(9);
      expect(info.metacritic_score).toBeNull();
      expect(info.metacritic_url).toBeNull();
    });

    it("should handle release date correctly for Riverbond", async () => {
      const appId = await steam.findSteamId("Riverbond");
      expect(appId).toBeDefined();
      if (!appId) return;
      const info = await steam.getDetails(appId);
      expect(info).toBeDefined();
      expect(info.name).toBe("Riverbond");
      expect(info.release_date).toBe("2019-06-09T00:00:00.000Z");
    });

    it("should handle recommendations", async () => {
      const appId = await steam.findSteamId("Riverbond");
      expect(appId).toBeDefined();
      if (!appId) return;
      const info = await steam.getDetails(appId);
      expect(info).toBeDefined();
      expect(info.name).toBe("Riverbond");
      expect(info.recommendations).toBeGreaterThan(0);
    });

    it("should handle games with no rating", async () => {
      const appId = await steam.findSteamId("Project Malice");
      expect(appId).toBeDefined();
      if (!appId) return;
      const info = await steam.getDetails(appId);
      expect(info).toBeDefined();
      expect(info.name).toBe("Project Malice");
      expect(info.recommendations).not.toBeNull();
    });

    // This is a weird one where without the cc parameter the price had been
    // shown in "KWR" in the JSON, so the store page had to be used instead to
    // get the price in EUR. Hopefully not needed any more.
    it("should handle currency correctly for Cities: Skylines", async () => {
      const appId = await steam.findSteamId("Cities: Skylines");
      expect(appId).toBeDefined();
      if (!appId) return;
      const info = await steam.getDetails(appId);
      expect(info).toBeDefined();
      expect(info.name).toBe("Cities: Skylines");
      expect(info.recommended_price_eur).toBe(27.99);
    });

    it("should handle free games correctly", async () => {
      const appId = await steam.findSteamId("World of Tanks");
      expect(appId).toBeDefined();
      if (!appId) return;
      const info = await steam.getDetails(appId);
      expect(info).toBeDefined();
      expect(info.name).toBe("World of Tanks");
      expect(info.recommended_price_eur).toBe(0);
    });

    it("should handle unavailable prices", async () => {
      const appId = await steam.findSteamId("Grand Theft Auto V");
      expect(appId).toBeDefined();
      if (!appId) return;
      const info = await steam.getDetails(appId);
      expect(info).toBeDefined();
      expect(info.name).toBe("Grand Theft Auto V");
      expect(info.recommended_price_eur).toBeNull();
    });

    // This game is free on the weekend, that changes the page layout
    // Obviously this test will not prove anything if the game currently is
    // not free on the weekend.
    it("should handle weekend free games", async () => {
      const appId = await steam.findSteamId(
        "Call of Duty®: Modern Warfare® II",
      );
      expect(appId).toBeDefined();
      if (!appId) return;
      const info = await steam.getDetails(appId);
      expect(info).toBeDefined();
      expect(info.name).toBe("Call of Duty®: Modern Warfare® II");
      expect(info.recommended_price_eur).toBe(69.99);
    });

    // Obviously this test will not prove anything if the game now has reviews
    it("should handle games with no reviews", async () => {
      const appId = await steam.findSteamId("Candy Kombat");
      expect(appId).toBeDefined();
      if (!appId) return;
      const info = await steam.getDetails(appId);
      expect(info).toBeDefined();
      expect(info.name).toBe("Candy Kombat");
      expect(info.percent).toBeNull();
    });

    // This game is included with EA Play, that changes the page layout
    it("should handle EA Play included games", async () => {
      const appId = await steam.findSteamId("Battlefield™ 2042");
      expect(appId).toBeDefined();
      if (!appId) return;
      const info = await steam.getDetails(appId);
      expect(info).toBeDefined();
      expect(info.name).toBe("Battlefield™ 2042");
      expect(info.recommended_price_eur).toBe(59.99);
    });

    it("should return English descriptions", async () => {
      const appId = await steam.findSteamId("Warframe");
      expect(appId).toBeDefined();
      if (!appId) return;
      const info = await steam.getDetails(appId);
      expect(info).toBeDefined();
      expect(info.name).toBe("Warframe");
      expect(info.short_description?.startsWith("Awaken")).toBeTruthy();
    });

    it("should handle age-restricted games", async () => {
      const appId = await steam.findSteamId("Doom Eternal");
      expect(appId).toBeDefined();
      if (!appId) return;
      const info = await steam.getDetails(appId);
      expect(info).toBeDefined();
      expect(info.name).toBe("DOOM Eternal");
      expect(info.release_date).toBe("2020-03-19T00:00:00.000Z");
    });

    it("should handle multiple genres", async () => {
      const info = await steam.getDetails(1424910);
      expect(info).toBeDefined();
      expect(info.genres).toBe("Action, Indie, Racing, Early Access");
    });
  });
});

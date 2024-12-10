import { config } from "@/services/config";
import { beforeEach, describe, expect, test } from "vitest";
import { IgdbClient } from "./igdb";

describe("IgdbClient", () => {
  let client: IgdbClient;

  beforeEach(() => {
    // Load the configuration
    config.loadConfig();
    const testConfig = config.get();
    client = new IgdbClient(
      testConfig.igdb.clientId,
      testConfig.igdb.clientSecret,
    );
  });

  test("searchGame resolves Rainbow Six Siege correctly", async () => {
    const result = await client.searchGame("Rainbow Six Siege");
    expect(result).toBe(7360);
  });

  // test("searchGame handles special characters", async () => {
  //   const mockSearchResponse = [
  //     { id: 66, name: "Monkey Island 2 Special Edition: LeChuck's Revenge" },
  //   ];

  //   vi.mocked(fetch).mockResolvedValueOnce({
  //     ok: true,
  //     json: () => Promise.resolve(mockSearchResponse),
  //   } as Response);

  //   const result = await client.searchGame(
  //     "Monkey Island 2 Special Edition: LeChuck's Revenge",
  //   );
  //   expect(result).toBe(66);
  // });

  // test("getDetails returns correct game info", async () => {
  //   const mockDetailsResponse = [
  //     {
  //       id: 1942,
  //       name: "Counter-Strike",
  //       summary: "Counter-Strike is a tactical first-person shooter...",
  //       url: "https://www.igdb.com/games/counter-strike",
  //       first_release_date: 973728000, // 2000-11-09
  //       rating: 85.5,
  //       rating_count: 450,
  //       aggregated_rating: 88.0,
  //       aggregated_rating_count: 5,
  //     },
  //   ];

  //   vi.mocked(fetch).mockResolvedValueOnce({
  //     ok: true,
  //     json: () => Promise.resolve(mockDetailsResponse),
  //   } as Response);

  //   const details = await client.getDetails(1942);

  //   expect(details).toEqual({
  //     name: "Counter-Strike",
  //     shortDescription: "Counter-Strike is a tactical first-person shooter...",
  //     releaseDate: new Date("2000-11-09T00:00:00.000Z"),
  //     url: "https://www.igdb.com/games/counter-strike",
  //     userScore: 85.5,
  //     userRatings: 450,
  //     metaScore: 88.0,
  //     metaRatings: 5,
  //   });
  // });

  // test("searchGame returns null for no matches", async () => {
  //   vi.mocked(fetch).mockResolvedValueOnce({
  //     ok: true,
  //     json: () => Promise.resolve([]),
  //   } as Response);

  //   const result = await client.searchGame("XXXXXXXXXXXXXXXXXXXXXXXXXXXX");
  //   expect(result).toBeNull();
  // });

  // test("getDetails returns null for invalid game ID", async () => {
  //   vi.mocked(fetch).mockResolvedValueOnce({
  //     ok: true,
  //     json: () => Promise.resolve([]),
  //   } as Response);

  //   const result = await client.getDetails(999999);
  //   expect(result).toBeNull();
  // });
});

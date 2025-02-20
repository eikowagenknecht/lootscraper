import { config } from "@/services/config";
import type { NewIgdbInfo } from "@/types/database";
import { DateTime } from "luxon";
import { beforeEach, describe, expect, test } from "vitest";
import { IgdbClient } from "./igdb";

const runThis =
  process.env.VSCODE_PID !== undefined ||
  process.env.VITEST_MODE === "contract";

describe.skipIf(!runThis)("IgdbClient", () => {
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

  test("searchGame resolves Counter Strike correctly", async () => {
    const result = await client.searchGame("Counter-Strike");
    expect(result).toBe(241);
  });

  test("searchGame resolves Lure of the Temptress", async () => {
    const result = await client.searchGame("Lure of the Temptress");
    expect(result).toBe(8482);
  });

  test("getDetails returns correct game info", async () => {
    const details: NewIgdbInfo | null = await client.getDetails(241);

    expect(details?.id).toBe(241);
    expect(details?.name).toBe("Counter-Strike");
    expect(details?.short_description).toBe(
      "Play the world's number 1 online action game. Engage in an incredibly realistic brand of terrorist warfare in this wildly popular team-based game. Ally with teammates to complete strategic missions. Take out enemy sites. Rescue hostages. Your role affects your team's success. Your team's success affects your role.",
    );
    expect(details?.meta_ratings).toBeGreaterThan(1);
    expect(details?.meta_score).toBeGreaterThan(50);
    expect(details?.url).toBe("https://www.igdb.com/games/counter-strike");
    expect(details?.user_score).toBeGreaterThan(50);
    expect(details?.user_ratings).toBeGreaterThan(600);
    expect(details?.release_date).toBe(
      DateTime.fromISO("2000-11-09T00:00:00.000Z").toISO(),
    );
  });

  test("searchGame handles special characters", async () => {
    const result = await client.searchGame(
      "Monkey Island 2 Special Edition: LeChuck's Revenge",
    );
    expect(result).toBe(66);
  });

  test("searchGame returns null for no matches", async () => {
    const result = await client.searchGame("XXXXXXXXXXXXXXXXXXXXXXXXXXXX");
    expect(result).toBeNull();
  });

  test("getDetails returns null for invalid game ID", async () => {
    const result = await client.getDetails(99999999);
    expect(result).toBeNull();
  });
});

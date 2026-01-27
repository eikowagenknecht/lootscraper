import { beforeEach, describe, expect, test, vi } from "vitest";

import { config } from "@/services/config";

import { IgdbClient } from "./igdb";

describe("IgdbClient", () => {
  let client: IgdbClient;

  beforeEach(() => {
    // Load the configuration
    config.loadConfig();
    const testConfig = config.get();
    client = new IgdbClient(testConfig.igdb.clientId, testConfig.igdb.clientSecret);

    // Reset mocks before each test
    vi.resetAllMocks();

    // Mock fetch globally
    globalThis.fetch = vi.fn();

    // Mock successful auth by default
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: "mock_token",
          expires_in: 3600,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
  });

  test("searchGame resolves Rainbow Six Siege correctly", async () => {
    // Second fetch call is the actual API request
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: 7360, name: "Rainbow Six Siege" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await client.searchGame("Rainbow Six Siege");
    expect(result).toBe(7360);
    expect(fetch).toHaveBeenCalledTimes(2);

    // Verify the calls happened
    expect(fetch).toHaveBeenNthCalledWith(1, "https://id.twitch.tv/oauth2/token", {
      method: "POST",
      body: expect.any(URLSearchParams) as URLSearchParams,
    });

    const secondCallOptions = vi.mocked(fetch).mock.calls[1]?.[1];
    expect(secondCallOptions?.method).toBe("POST");
    expect(secondCallOptions?.headers).toEqual({
      "Client-ID": expect.any(String) as string,
      Authorization: "Bearer mock_token",
    });
    const expectedQuery = `search "Rainbow Six Siege";
fields name;
where version_parent = null;
limit 50;
`;
    expect(secondCallOptions?.body).toBe(expectedQuery);
  });

  test("getDetails returns correct game info", async () => {
    const mockGameDetails = {
      id: 241,
      name: "Counter-Strike",
      url: "https://www.igdb.com/games/counter-strike",
      summary: "Play the world's number 1 online action game.",
      first_release_date: 973_728_000, // 2000-11-09 in Unix timestamp
      rating: 90,
      rating_count: 1000,
      aggregated_rating: 88,
      aggregated_rating_count: 50,
    };

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify([mockGameDetails]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const details = await client.getDetails(241);

    expect(details).toEqual({
      id: 241,
      name: "Counter-Strike",
      url: "https://www.igdb.com/games/counter-strike",
      short_description: "Play the world's number 1 online action game.",
      release_date: "2000-11-09T00:00:00.000Z",
      user_score: 90,
      user_ratings: 1000,
      meta_score: 88,
      meta_ratings: 50,
    });
  });

  test("searchGame handles special characters", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            id: 66,
            name: "Monkey Island 2 Special Edition: LeChuck's Revenge",
          },
        ]),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const result = await client.searchGame("Monkey Island 2 Special Edition: LeChuck's Revenge");
    expect(result).toBe(66);
  });

  test("searchGame returns null for no matches", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await client.searchGame("XXXXXXXXXXXXXXXXXXXXXXXXXXXX");
    expect(result).toBeNull();
  });

  test("getDetails returns null for invalid game ID", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await client.getDetails(99_999_999);
    expect(result).toBeNull();
  });

  test("handles auth failure", async () => {
    vi.resetAllMocks(); // Reset to remove default auth mock

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Invalid client" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(client.searchGame("Counter-Strike")).rejects.toThrow("IGDB auth failed");
  });

  test("handles API errors", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(client.searchGame("Counter-Strike")).rejects.toThrow("IGDB API error");
  });

  test("reuses auth token when not expired", async () => {
    // First call succeeds
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: 241, name: "Counter-Strike" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await client.searchGame("Counter-Strike");

    // Second call should reuse token
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: 7360, name: "Rainbow Six Siege" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await client.searchGame("Rainbow Six Siege");

    // Should see 3 calls total: 1 auth + 2 API requests
    expect(fetch).toHaveBeenCalledTimes(3);

    // First call should be auth
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "https://id.twitch.tv/oauth2/token",
      expect.anything(),
    );

    // Subsequent calls should be API requests with same token
    const secondCall = vi.mocked(fetch).mock.calls[1][1];
    const thirdCall = vi.mocked(fetch).mock.calls[2][1];
    expect(secondCall?.headers).toEqual(thirdCall?.headers);
  });

  test("renews expired auth token", async () => {
    // Mock Date.now() to control token expiration
    const realDateNow = Date.now;
    let currentTime = 1_000_000;
    globalThis.Date.now = vi.fn(() => currentTime);

    // First auth token
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: "token1",
          expires_in: 3600,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    // First API call
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: 241, name: "Counter-Strike" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await client.searchGame("Counter-Strike");

    // Advance time past token expiration
    currentTime += 4_000_000; // More than expires_in

    // Second auth token
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: "token2",
          expires_in: 3600,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    // Second API call
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: 7360, name: "Rainbow Six Siege" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await client.searchGame("Rainbow Six Siege");

    // Restore Date.now
    globalThis.Date.now = realDateNow;

    // Should see 4 calls total: 2 auth + 2 API requests
    expect(fetch).toHaveBeenCalledTimes(4);

    // Verify different tokens were used
    const firstApiCall = vi.mocked(fetch).mock.calls[1][1];
    const secondApiCall = vi.mocked(fetch).mock.calls[3][1];
    expect(firstApiCall?.headers).not.toEqual(secondApiCall?.headers);
  });
});

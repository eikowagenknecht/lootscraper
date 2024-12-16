import type { NewIgdbInfo } from "@/types/database";
import { getMatchScore, normalizeString } from "@/utils";
import { logger } from "@/utils/logger";
import { DateTime } from "luxon";

interface IgdbAuth {
  accessToken: string;
  expiresAt: number;
}

interface IgdbGameResult {
  id: number; // IGDB ID
  name: string; // Game title
  url: string; // URL to the game on IGDB
  summary?: string; // Short description
  first_release_date?: number; // Release data as Unix timestamp (s)
  rating?: number; // User score
  rating_count?: number; // User ratings
  aggregated_rating?: number; // Meta score
  aggregated_rating_count?: number; // Meta ratings
}

interface IgdbSearchResult {
  id: number;
  name: string;
}

export class IgdbClient {
  private static readonly API_URL = "https://api.igdb.com/v4";
  private static readonly AUTH_URL = "https://id.twitch.tv/oauth2/token";
  private static readonly MINIMUM_ACCEPTABLE_SCORE = 0.75;

  private auth: IgdbAuth | null = null;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  /**
   * Search IGDB via the APIv4 and return the best match in the results.
   *
   * The comparison is done with difflib, lower cased.
   * @param searchString
   * @returns
   */
  public async searchGame(searchString: string): Promise<number | null> {
    await this.ensureAuth();

    const query = `search "${normalizeString(searchString)}";
fields name;
where version_parent = null;
limit 50;
`;

    logger.debug(`Searching for game: ${searchString} with query: ${query}`);

    const results = await this.apiRequest<IgdbSearchResult[]>("games", query);

    if (!results.length) return null;

    let bestMatch: { id: number; score: number; title: string } | null = null;
    for (const game of results) {
      const score = getMatchScore(searchString, game.name);
      if (
        score >= IgdbClient.MINIMUM_ACCEPTABLE_SCORE &&
        (!bestMatch || score > bestMatch.score)
      ) {
        bestMatch = { id: game.id, score, title: game.name };
        logger.debug(
          `Found match ${game.name} with score ${(score * 100).toFixed()}%`,
        );
      } else {
        logger.debug(
          `Rejected match ${game.name} as it's score of ${(score * 100).toFixed()}% is too low.`,
        );
      }
    }

    if (!bestMatch) {
      logger.debug(`No match found for ${searchString}.`);
      return null;
    }

    logger.debug(
      `Best match for ${searchString} is ${bestMatch.title} with score ${(bestMatch.score * 100).toFixed()}%.`,
    );
    return bestMatch.id;
  }

  public async getDetails(gameId: number): Promise<NewIgdbInfo | null> {
    await this.ensureAuth();

    const query = `
      fields *;
      where id = ${gameId.toFixed()};
    `;

    const results = await this.apiRequest<IgdbGameResult[]>("games", query);

    if (!results.length) return null;

    // We're searching by ID, so we only get one result
    const [game] = results;

    return {
      id: game.id,
      name: game.name,
      url: game.url,
      short_description: game.summary ?? null,
      release_date: game.first_release_date
        ? DateTime.fromSeconds(game.first_release_date).toISO()
        : null,
      user_score: game.rating ? Math.round(game.rating) : null,
      user_ratings: game.rating_count ?? null,
      meta_score: game.aggregated_rating
        ? Math.round(game.aggregated_rating)
        : null,
      meta_ratings: game.aggregated_rating_count ?? null,
    };
  }

  private async ensureAuth(): Promise<void> {
    if (this.auth) {
      const expiresSoon =
        DateTime.now() <
        DateTime.fromMillis(this.auth.expiresAt).minus({ minutes: 1 });
      if (expiresSoon) return;
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: "client_credentials",
    });

    const response = await fetch(IgdbClient.AUTH_URL, {
      method: "POST",
      body: params,
    });

    if (!response.ok) {
      throw new Error(`IGDB auth failed: ${response.statusText}`);
    }

    const { access_token, expires_in } = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };

    this.auth = {
      accessToken: access_token,
      expiresAt: DateTime.now().plus({ seconds: expires_in }).toMillis(),
    };
  }

  private async apiRequest<T>(endpoint: string, query: string): Promise<T> {
    if (!this.auth) throw new Error("Not authenticated");

    const response = await fetch(`${IgdbClient.API_URL}/${endpoint}`, {
      method: "POST",
      headers: {
        "Client-ID": this.clientId,
        Authorization: `Bearer ${this.auth.accessToken}`,
      },
      body: query,
    });

    logger.debug(
      `IGDB API request to ${endpoint} returned status ${response.status.toFixed()} (ok: ${response.ok ? "yes" : "no"}).`,
    );
    if (!response.ok) {
      throw new Error(`IGDB API error: ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }
}

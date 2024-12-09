import type { NewIgdbInfo } from "@/types/database";
import { logger } from "@/utils/logger";

interface IgdbAuth {
  accessToken: string;
  expiresAt: number;
}

interface IgdbGame {
  id: number;
  name: string;
  url: string;
  summary?: string;
  first_release_date?: number;
  rating?: number;
  rating_count?: number;
  aggregated_rating?: number;
  aggregated_rating_count?: number;
}

interface IgdbSearchResult {
  id: number;
  name: string;
}

export class IgdbClient {
  private static readonly API_URL = "https://api.igdb.com/v4";
  private static readonly AUTH_URL = "https://id.twitch.tv/oauth2/token";
  private auth: IgdbAuth | null = null;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  public async searchGame(gameName: string): Promise<number | null> {
    await this.ensureAuth();

    const query = `
      search "${this.escapeString(gameName)}";
      fields name;
      where version_parent = null;
      limit 50;
    `;

    const results = await this.apiRequest<IgdbSearchResult[]>("games", query);
    if (!results.length) return null;

    let bestMatch: { id: number; score: number; title: string } | null = null;
    for (const game of results) {
      const score = this.getMatchScore(gameName, game.name);
      if (score >= 0.75 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { id: game.id, score, title: game.name };
        logger.debug(
          `Found match ${game.name} with score ${(score * 100).toFixed(0)}%`,
        );
      }
    }

    return bestMatch?.id ?? null;
  }

  public async getDetails(gameId: number): Promise<NewIgdbInfo | null> {
    await this.ensureAuth();

    const query = `
      fields *;
      where id = ${gameId.toFixed(0)};
    `;

    const [game] = await this.apiRequest<IgdbGame[]>("games", query);

    return {
      id: game.id,
      url: game.url,
      name: game.name,
      short_description: game.summary ?? null,
      release_date: game.first_release_date
        ? new Date(game.first_release_date * 1000).toISOString()
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
    if (this.auth && Date.now() < this.auth.expiresAt - 60000) {
      return;
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
      expiresAt: Date.now() + expires_in * 1000,
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

    if (!response.ok) {
      throw new Error(`IGDB API error: ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  private escapeString(str: string): string {
    return (
      str
        .replace(/"/g, "")
        .normalize("NFD")
        // biome-ignore lint/suspicious/noMisleadingCharacterClass: TODO
        .replace(/[\u0300-\u036f]|./g, "")
    );
  }

  private getMatchScore(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 1;
    if (s1.includes(s2) || s2.includes(s1)) return 0.9;

    let matches = 0;
    const words1 = new Set(s1.split(/\s+/));
    const words2 = new Set(s2.split(/\s+/));

    for (const word of words1) {
      if (words2.has(word)) matches++;
    }

    return (matches * 2) / (words1.size + words2.size);
  }
}

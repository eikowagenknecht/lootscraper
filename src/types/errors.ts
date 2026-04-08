// TODO: Use these more consistently
export class LootScraperError extends Error {
  override name = "LootScraperError";
}

export class ConfigError extends LootScraperError {
  override name = "ConfigError";

  constructor(message: string) {
    super(`Configuration error: ${message}`);
  }
}

export class ScraperError extends LootScraperError {
  override name = "ScraperError";

  constructor(
    message: string,
    public readonly source: string,
    public readonly url?: string,
  ) {
    super(`Scraper error (${source}): ${message}${url ? ` at ${url}` : ""}`);
  }
}

export class DatabaseError extends LootScraperError {
  override name = "DatabaseError";

  constructor(
    message: string,
    public override readonly cause?: Error,
  ) {
    super(`Database error: ${message}`);
  }
}

export class BrowserError extends LootScraperError {
  override name = "BrowserError";

  constructor(
    message: string,
    public readonly url?: string,
  ) {
    super(`Browser error: ${message}${url ? ` at ${url}` : ""}`);
  }
}

export class FeedError extends LootScraperError {
  override name = "FeedError";

  constructor(message: string) {
    super(`Feed generation error: ${message}`);
  }
}

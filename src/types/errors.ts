export class LootScraperError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ConfigError extends LootScraperError {
  constructor(message: string) {
    super(`Configuration error: ${message}`);
  }
}

export class ScraperError extends LootScraperError {
  constructor(
    message: string,
    public readonly source: string,
    public readonly url?: string,
  ) {
    super(`Scraper error (${source}): ${message}${url ? ` at ${url}` : ""}`);
  }
}

export class DatabaseError extends LootScraperError {
  constructor(
    message: string,
    public override readonly cause?: Error,
  ) {
    super(`Database error: ${message}`);
  }
}

export class BrowserError extends LootScraperError {
  constructor(
    message: string,
    public readonly url?: string,
  ) {
    super(`Browser error: ${message}${url ? ` at ${url}` : ""}`);
  }
}

export class FeedError extends LootScraperError {
  constructor(message: string) {
    super(`Feed generation error: ${message}`);
  }
}

export class BotError extends LootScraperError {
  constructor(
    message: string,
    public readonly chatId?: number,
  ) {
    super(
      `Bot error: ${message}${chatId ? ` for chat ${chatId.toFixed()}` : ""}`,
    );
  }
}

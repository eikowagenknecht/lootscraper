import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parse } from "yaml";
import { ZodError } from "zod";
import { allScrapers, type ScraperClass } from "@/services/scraper/utils";
import { ConfigError, InfoSource } from "@/types";
import { type Config, ConfigSchema } from "@/types/config";
import { logger } from "@/utils/logger";
import { getDataPath, getTemplatesPath } from "@/utils/path";

class ConfigValidationError extends ConfigError {
  constructor(
    message: string,
    public readonly validationErrors: ZodError[],
  ) {
    super(`${message}: ${validationErrors.map((e) => e.message).join(", ")}`);
  }
}

class ConfigService {
  private static instance: ConfigService;
  private config: Config | null = null;

  private constructor() {
    // Private constructor to prevent instantiation
  }

  public static getInstance(): ConfigService {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  public get(): Config {
    if (!this.config) {
      throw new ConfigError("Config not initialized. Call loadConfig() first.");
    }
    return this.config;
  }

  public loadConfig(configPath?: string): void {
    try {
      const path = configPath ?? resolve(getDataPath(), "config.yaml");

      // Check if config exists, if not copy the default one
      if (!this.fileExists(path)) {
        logger.info(
          `Config file not found at ${path}, creating default config.`,
        );
        this.createDefaultConfig(path);
      }

      logger.info(`Loading config from ${path}`);

      const configFile = readFileSync(path, "utf8");
      const parsedConfig: unknown = parse(configFile);

      // Validate basic structure and types
      const result = this.validateConfigSchema(parsedConfig);

      // Validate internal consistency
      this.validateConfigConsistency(result);

      this.config = result;
    } catch (error) {
      if (error instanceof Error) {
        throw new ConfigError(`Failed to load config: ${error.message}`);
      }
      throw error;
    }
  }

  private validateConfigSchema(config: unknown): Config {
    // First do a non-strict parse to collect all unknown fields
    const result = ConfigSchema.safeParse(config);

    // Then do a strict parse to catch extra fields
    const strictResult = ConfigSchema.strict().safeParse(config);

    if (!strictResult.success) {
      const unknownFieldErrors = strictResult.error.issues.filter(
        (issue) => issue.code === "unrecognized_keys",
      );

      if (unknownFieldErrors.length > 0) {
        throw new ConfigValidationError("Unknown fields in config", [
          new ZodError(unknownFieldErrors),
        ]);
      }
    }

    if (!result.success) {
      throw new ConfigValidationError("Invalid config schema", [result.error]);
    }

    return result.data;
  }

  private validateConfigConsistency(config: Config): void {
    const errors: ZodError[] = [];

    // Validate that actions have required configurations
    if (config.actions.uploadToFtp && !config.ftp.host) {
      errors.push(
        new ZodError([
          {
            code: "custom",
            path: ["ftp", "host"],
            message: "FTP host is required when uploadToFtp is enabled",
          },
        ]),
      );
    }

    if (config.actions.uploadToFtp && !config.ftp.user) {
      errors.push(
        new ZodError([
          {
            code: "custom",
            path: ["ftp", "user"],
            message: "FTP user is required when uploadToFtp is enabled",
          },
        ]),
      );
    }

    if (config.actions.uploadToFtp && !config.ftp.password) {
      errors.push(
        new ZodError([
          {
            code: "custom",
            path: ["ftp", "password"],
            message: "FTP password is required when uploadToFtp is enabled",
          },
        ]),
      );
    }

    if (config.actions.telegramBot && !config.telegram.accessToken) {
      errors.push(
        new ZodError([
          {
            code: "custom",
            path: ["telegram", "accessToken"],
            message:
              "Telegram access token is required when telegramBot is enabled",
          },
        ]),
      );
    }

    if (config.actions.telegramBot && !config.telegram.botOwnerUserId) {
      errors.push(
        new ZodError([
          {
            code: "custom",
            path: ["telegram", "botOwnerUserId"],
            message:
              "Bot owner user ID is required when telegramBot is enabled",
          },
        ]),
      );
    }

    // Validate that feed URLs are valid when feed generation is enabled
    if (config.actions.generateFeed) {
      try {
        new URL(config.feed.urlPrefix);
        new URL(config.feed.urlAlternate);
      } catch {
        errors.push(
          new ZodError([
            {
              code: "custom",
              path: ["feed"],
              message: "Invalid feed URLs provided",
            },
          ]),
        );
      }
    }

    // Validate that igdb credentials are provided when using the igdb scraper
    if (
      config.scraper.infoSources.includes(InfoSource.IGDB) &&
      !config.igdb.clientId
    ) {
      errors.push(
        new ZodError([
          {
            code: "custom",
            path: ["igdb", "clientId"],
            message:
              "IGDB client ID is required when IGDB is used as an info source",
          },
        ]),
      );
    }

    if (
      config.scraper.infoSources.includes(InfoSource.IGDB) &&
      !config.igdb.clientSecret
    ) {
      errors.push(
        new ZodError([
          {
            code: "custom",
            path: ["igdb", "clientSecret"],
            message:
              "IGDB client secret is required when IGDB is used as an info source",
          },
        ]),
      );
    }

    // Validate that scrapers are defined when scraping is enabled
    if (
      config.actions.scrapeOffers &&
      config.scraper.enabledScrapers.length === 0
    ) {
      errors.push(
        new ZodError([
          {
            code: "custom",
            path: ["scraper", "enabledScrapers"],
            message:
              "At least one scraper must be defined when scraping is enabled",
          },
        ]),
      );
    }

    // Validate that only valid scrapers are enabled
    if (config.actions.scrapeOffers) {
      for (const scraper of config.scraper.enabledScrapers) {
        const scraperList = allScrapers.map((s: ScraperClass) =>
          s.prototype.getScraperName(),
        );

        if (!scraperList.includes(scraper)) {
          errors.push(
            new ZodError([
              {
                code: "custom",
                path: ["scraper", "enabledScrapers"],
                message: `Invalid scraper enabled: ${scraper}`,
              },
            ]),
          );
        }
      }
    }

    if (errors.length > 0) {
      throw new ConfigValidationError(
        "Config consistency validation failed",
        errors,
      );
    }
  }

  private createDefaultConfig(targetPath: string): void {
    const defaultConfigPath = resolve(
      getTemplatesPath(),
      "config.default.yaml",
    );
    logger.info(
      `Copying default config from ${defaultConfigPath} to ${targetPath}`,
    );

    // Ensure the target directory exists
    mkdirSync(dirname(targetPath), { recursive: true });

    try {
      copyFileSync(defaultConfigPath, targetPath);
    } catch (error) {
      throw new ConfigError(
        `Failed to create default config: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private fileExists(path: string): boolean {
    try {
      readFileSync(path);
      return true;
    } catch {
      return false;
    }
  }
}

// Export a singleton instance
export const config = ConfigService.getInstance();

import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parse } from "yaml";
import * as z from "zod";

import type { ScraperClass } from "@/services/scraper/utils";
import type { Config } from "@/types/config";

import { allScrapers } from "@/services/scraper/utils";
import { ConfigError, InfoSource } from "@/types";
import { ConfigSchema } from "@/types/config";
import { logger } from "@/utils/logger";
import { getDataPath, getTemplatesPath } from "@/utils/path";

class ConfigValidationError extends ConfigError {
  constructor(
    message: string,
    public readonly validationErrors: z.ZodError[],
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
        logger.info(`Config file not found at ${path}, creating default config.`);
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
          new z.ZodError(unknownFieldErrors),
        ]);
      }
    }

    if (!result.success) {
      throw new ConfigValidationError("Invalid config schema", [result.error]);
    }

    return result.data;
  }

  private validateConfigConsistency(config: Config): void {
    const configConsistencySchema = ConfigSchema.check((ctx) => {
      const config = ctx.value;

      // Validate FTP configuration when uploadToFtp is enabled
      if (config.actions.uploadToFtp) {
        if (!config.ftp.host) {
          ctx.issues.push({
            code: "custom",
            path: ["ftp", "host"],
            message: "FTP host is required when uploadToFtp is enabled",
            input: config.ftp.host,
          });
        }
        if (!config.ftp.user) {
          ctx.issues.push({
            code: "custom",
            path: ["ftp", "user"],
            message: "FTP user is required when uploadToFtp is enabled",
            input: config.ftp.user,
          });
        }
        if (!config.ftp.password) {
          ctx.issues.push({
            code: "custom",
            path: ["ftp", "password"],
            message: "FTP password is required when uploadToFtp is enabled",
            input: config.ftp.password,
          });
        }
      }

      // Validate Telegram configuration when telegramBot is enabled
      if (config.actions.telegramBot) {
        if (!config.telegram.accessToken) {
          ctx.issues.push({
            code: "custom",
            path: ["telegram", "accessToken"],
            message: "Telegram access token is required when telegramBot is enabled",
            input: config.telegram.accessToken,
          });
        }
        if (!config.telegram.botOwnerUserId) {
          ctx.issues.push({
            code: "custom",
            path: ["telegram", "botOwnerUserId"],
            message: "Bot owner user ID is required when telegramBot is enabled",
            input: config.telegram.botOwnerUserId,
          });
        }
      }

      // Validate feed URLs when feed generation is enabled
      if (config.actions.generateFeed) {
        if (!URL.canParse(config.feed.urlPrefix)) {
          ctx.issues.push({
            code: "custom",
            path: ["feed", "urlPrefix"],
            message: "Invalid feed URL prefix provided",
            input: config.feed.urlPrefix,
          });
        }

        if (!URL.canParse(config.feed.urlAlternate)) {
          ctx.issues.push({
            code: "custom",
            path: ["feed", "urlAlternate"],
            message: "Invalid feed alternate URL provided",
            input: config.feed.urlAlternate,
          });
        }
      }

      // Validate IGDB credentials when IGDB is used as info source
      if (config.scraper.infoSources.includes(InfoSource.IGDB)) {
        if (!config.igdb.clientId) {
          ctx.issues.push({
            code: "custom",
            path: ["igdb", "clientId"],
            message: "IGDB client ID is required when IGDB is used as an info source",
            input: config.igdb.clientId,
          });
        }
        if (!config.igdb.clientSecret) {
          ctx.issues.push({
            code: "custom",
            path: ["igdb", "clientSecret"],
            message: "IGDB client secret is required when IGDB is used as an info source",
            input: config.igdb.clientSecret,
          });
        }
      }

      // Validate scrapers configuration when scraping is enabled
      if (config.actions.scrapeOffers) {
        if (config.scraper.enabledScrapers.length === 0) {
          ctx.issues.push({
            code: "custom",
            path: ["scraper", "enabledScrapers"],
            message: "At least one scraper must be defined when scraping is enabled",
            input: config.scraper.enabledScrapers,
          });
        }

        // Validate that only valid scrapers are enabled
        const scraperList = allScrapers.map((s: ScraperClass) => s.prototype.getScraperName());

        for (const [index, scraper] of config.scraper.enabledScrapers.entries()) {
          if (!scraperList.includes(scraper)) {
            ctx.issues.push({
              code: "custom",
              path: ["scraper", "enabledScrapers", index],
              message: `Invalid scraper enabled: ${scraper}`,
              input: scraper,
            });
          }
        }
      }
    });

    const result = configConsistencySchema.safeParse(config);

    if (!result.success) {
      throw new ConfigValidationError("Config consistency validation failed", [result.error]);
    }
  }

  private createDefaultConfig(targetPath: string): void {
    const defaultConfigPath = resolve(getTemplatesPath(), "config.default.yaml");
    logger.info(`Copying default config from ${defaultConfigPath} to ${targetPath}`);

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

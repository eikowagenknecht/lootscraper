import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { type Config, ConfigSchema } from "@/types/config";
import { logger } from "@/utils/logger";
import { getDataPath } from "@/utils/path";
import { parse } from "yaml";

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export class ConfigService {
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

      const result = ConfigSchema.safeParse(parsedConfig);

      if (!result.success) {
        throw new ConfigError(
          `Invalid config: ${result.error.errors.map((e) => e.message).join(", ")}`,
        );
      }

      this.config = result.data;
    } catch (error) {
      if (error instanceof Error) {
        throw new ConfigError(`Failed to load config: ${error.message}`);
      }
      throw error;
    }
  }

  private createDefaultConfig(targetPath: string): void {
    const defaultConfigPath = resolve(
      __dirname,
      "../../templates/config.default.yaml",
    );

    // Ensure the target directory exists
    mkdirSync(dirname(targetPath), { recursive: true });

    try {
      copyFileSync(defaultConfigPath, targetPath);
      logger.info(`Created new config file at ${targetPath}`);
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

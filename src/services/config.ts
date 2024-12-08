import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { type Config, ConfigSchema } from "@/types/config";
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
      const path = configPath ?? this.getDefaultConfigPath();

      // Check if config exists, if not copy the default one
      if (!this.fileExists(path)) {
        this.createDefaultConfig(path);
      }

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
      "../../config/config.default.yaml",
    );

    // Ensure the target directory exists
    mkdirSync(dirname(targetPath), { recursive: true });

    try {
      copyFileSync(defaultConfigPath, targetPath);
      console.log(`Created new config file at ${targetPath}`);
    } catch (error) {
      throw new ConfigError(
        `Failed to create default config: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private getDefaultConfigPath(): string {
    // Check for Docker environment
    const dockerPath = "/data/config.yaml";
    if (this.fileExists(dockerPath)) {
      return dockerPath;
    }

    // Fall back to local config
    return resolve(process.cwd(), "data", "config.yaml");
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

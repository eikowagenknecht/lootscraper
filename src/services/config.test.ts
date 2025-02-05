import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { config } from "@/services/config";
import { ConfigError } from "@/types";
import { getDataPath } from "@/utils/path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

describe("ConfigService", () => {
  const tempDir = resolve(getDataPath(), "test");
  const tempConfigPath = resolve(tempDir, "config.yaml");

  beforeEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("should create default config if none exists", () => {
    config.loadConfig(tempConfigPath);
    const configContent = readFileSync(tempConfigPath, "utf8");
    expect(configContent).toContain("common:");
    expect(configContent).toContain("scraper:");
  });

  test("should load existing valid config file", () => {
    const validConfig = `
common:
  databaseFile: test.db
  logLevel: INFO
browser:
  timeoutSeconds: 5
scraper:
  enabledScrapers: [SteamGames]
actions:
  scrapeInfo: true
telegram:
  logLevel: ERROR
igdb: {}
ftp: {}
feed:
  authorName: Test Author
`;
    writeFileSync(tempConfigPath, validConfig);
    config.loadConfig(tempConfigPath);
    const result = config.get();
    expect(result.common.databaseFile).toBe("test.db");
    expect(result.scraper.enabledScrapers).toContain("SteamGames");
  });

  test("should throw on invalid log level", () => {
    const invalidConfig = `
common:
  logLevel: INVALID_LEVEL
`;
    writeFileSync(tempConfigPath, invalidConfig);
    expect(() => {
      config.loadConfig(tempConfigPath);
    }).toThrow(ConfigError);
  });

  test("should throw on invalid scraper", () => {
    const invalidConfig = `
scraper:
  enabledScrapers: [InvalidScraper]
`;
    writeFileSync(tempConfigPath, invalidConfig);
    expect(() => {
      config.loadConfig(tempConfigPath);
    }).toThrow(ConfigError);
  });
});

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
expert:
  dbEcho: false
scraper:
  offerSources: [STEAM, EPIC]
  offerTypes: [GAME]
  offerDurations: [CLAIMABLE]
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
    expect(result.scraper.offerSources).toContain("STEAM");
  });

  test("should throw on invalid config", () => {
    const invalidConfig = `
common:
  logLevel: INVALID_LEVEL
`;
    writeFileSync(tempConfigPath, invalidConfig);
    expect(() => {
      config.loadConfig(tempConfigPath);
    }).toThrow(ConfigError);
  });
});

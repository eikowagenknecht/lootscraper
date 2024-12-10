import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ConfigError, config } from "@/services/config";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("ConfigService", () => {
  const tempDir = join(process.cwd(), "data_test");
  const tempConfigPath = join(tempDir, "config.yaml");

  beforeEach(() => {
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should create default config if none exists", () => {
    config.loadConfig(tempConfigPath);

    const configContent = readFileSync(tempConfigPath, "utf8");
    expect(configContent).toContain("common:");
    expect(configContent).toContain("scraper:");
  });

  it("should load existing valid config file", () => {
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

  it("should throw on invalid config", () => {
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

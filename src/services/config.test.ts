import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConfigError, config } from "@/services/config";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("ConfigService", () => {
  const tempDir = join(tmpdir(), "lootscraper-tests");
  const tempConfigPath = join(tempDir, "config.yaml");

  beforeEach(() => {
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    try {
      unlinkSync(tempConfigPath);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  it("should load a valid config file", () => {
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

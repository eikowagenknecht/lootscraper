import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { logger } from "@/utils/logger";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

describe("logger", () => {
  const tempDir = join(tmpdir(), "lootscraper-tests");

  beforeEach(() => {
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("should log messages without throwing", () => {
    expect(() => {
      logger.info("Test info message");
      logger.error("Test error message");
      logger.warn("Test warning message");
      logger.debug("Test debug message");
    }).not.toThrow();
  });

  test("should log errors with metadata", () => {
    const error = new Error("Test error");
    expect(() => {
      logger.error("Error occurred", { error });
    }).not.toThrow();
  });
});

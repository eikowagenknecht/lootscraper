import { OfferDuration, OfferType } from "@/types/basic";
import { OfferSource } from "@/types/basic";
import { describe, expect, test } from "vitest";
import {
  type FilenameOptions,
  generateFeedTitle,
  generateFilename,
} from "./names";

describe("generateFilename", () => {
  const baseOptions: FilenameOptions = {
    prefix: "lootscraper",
    extension: "xml",
  };

  test("should generate basic filename with just prefix", () => {
    expect(generateFilename(baseOptions)).toBe("lootscraper.xml");
  });

  test("should include all flag when true", () => {
    expect(
      generateFilename({
        ...baseOptions,
        withHistory: true,
      }),
    ).toBe("lootscraper_all.xml");
  });

  test("should combine all options in correct order", () => {
    expect(
      generateFilename({
        ...baseOptions,
        combination: {
          source: OfferSource.EPIC,
          type: OfferType.GAME,
          duration: OfferDuration.TEMPORARY,
        },
        withHistory: true,
      }),
    ).toBe("lootscraper_epic_game_temporary_all.xml");
  });
});

describe("generateFeedTitle", () => {
  test("should return default title when no options provided", () => {
    expect(generateFeedTitle()).toBe("Free Games and Loot");
  });

  test("should combine all options in correct order", () => {
    expect(
      generateFeedTitle({
        source: OfferSource.EPIC,
        type: OfferType.GAME,
        duration: OfferDuration.TEMPORARY,
      }),
    ).toBe("Free Epic Games (TEMPORARY)");
  });
});

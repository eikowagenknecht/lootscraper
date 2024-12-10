import { describe, test } from "vitest";
import { getMatchScore } from "./stringTools";

describe.concurrent("getMatchScore", () => {
  interface TestCase {
    search: string;
    result: string;
    expectedScore: number;
    description: string;
    approximateMatch?: boolean;
  }

  const testCases: TestCase[] = [
    {
      search: "hello world",
      result: "hello world",
      expectedScore: 1.0,
      description: "exact match",
    },
    {
      search: "Hello World!",
      result: "hello world",
      expectedScore: 1.0,
      description: "case and punctuation insensitive match",
    },
    {
      search: "hello",
      result: "hello world",
      expectedScore: 0.99,
      description: "partial match at start with penalty",
      approximateMatch: true,
    },
    {
      search: "world",
      result: "hello world",
      expectedScore: 0.99,
      description: "partial match at end with penalty",
      approximateMatch: true,
    },
    {
      search: "helo world",
      result: "hello world",
      expectedScore: 0.91,
      description: "slight misspelling",
      approximateMatch: true,
    },
    {
      search: "completely different",
      result: "hello world",
      expectedScore: 0.19,
      description: "no meaningful match",
      approximateMatch: true,
    },
    {
      search: "",
      result: "hello world",
      expectedScore: 0,
      description: "empty search string",
    },
    {
      search: "hello world",
      result: "",
      expectedScore: 0,
      description: "empty result string",
    },
    {
      search: "",
      result: "",
      expectedScore: 1.0,
      description: "both strings empty",
    },
    {
      search: "hello   world",
      result: "hello world",
      expectedScore: 1.0,
      description: "multiple spaces are condensed",
    },
    {
      search: "Rainbow Six Siege",
      result: "Tom Clancy's Rainbow Six® Siege",
      expectedScore: 0.99,
      description: "game title with trademark and prefix",
      approximateMatch: true,
    },
    {
      search: "Fall Guys",
      result: "Fall Guy",
      expectedScore: 0.89,
      description: "similar game title with plural difference",
      approximateMatch: true,
    },
  ];

  for (const {
    search,
    result,
    expectedScore,
    description,
    approximateMatch,
  } of testCases) {
    test(`should handle ${description}`, ({ expect }) => {
      const score = getMatchScore(search, result);

      if (approximateMatch) {
        expect(score).toBeCloseTo(expectedScore, 2);
      } else {
        expect(score).toBe(expectedScore);
      }
    });
  }

  test("should handle special characters", ({ expect }) => {
    const search = "hello@world!";
    const result = "hello#world?";
    const score = getMatchScore(search, result);

    expect(score).toBe(1.0);
  });

  test("should ensure Fall Guys comparison scores below threshold", ({
    expect,
  }) => {
    const search = "Fall Guys";
    const result = "Fall Guy";
    const score = getMatchScore(search, result);

    expect(score).toBeLessThan(0.99);
  });
});

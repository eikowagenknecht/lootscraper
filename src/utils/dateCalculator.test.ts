import { describe, test } from "vitest";
import { calculateRealValidTo } from "./dateCalculator";

describe.concurrent("Date Calculator", () => {
  test("should use seen_last if valid_to is far in the future", ({
    expect,
  }) => {
    const seenLast = new Date("2020-06-01T00:00:00Z");
    const validTo = new Date("2020-06-15T00:00:00Z");
    const now = new Date("2022-01-01T00:00:00Z");

    const realValidTo = calculateRealValidTo(seenLast, validTo, now);
    expect(realValidTo).toStrictEqual(seenLast);
  });

  test("should use valid_to if still current", ({ expect }) => {
    const seenLast = new Date("2020-06-01T00:00:00Z");
    const validTo = new Date("2020-06-15T00:00:00Z");
    const now = new Date("2020-06-01T00:00:01Z");

    const realValidTo = calculateRealValidTo(seenLast, validTo, now);
    expect(realValidTo).toStrictEqual(validTo);
  });

  test("should return null if no valid_to and recently seen", ({ expect }) => {
    const seenLast = new Date("2020-06-01T00:00:00Z");
    const now = new Date("2020-06-01T00:00:01Z");

    const realValidTo = calculateRealValidTo(seenLast, null, now);
    expect(realValidTo).toBeNull();
  });

  test("should use seen_last if no valid_to and not seen recently", ({
    expect,
  }) => {
    const seenLast = new Date("2020-06-01T00:00:00Z");
    const now = new Date("2020-06-03T00:00:00Z");

    const realValidTo = calculateRealValidTo(seenLast, null, now);
    expect(realValidTo).toStrictEqual(seenLast);
  });

  test("should use valid_to if still within timeframe", ({ expect }) => {
    const seenLast = new Date("2020-06-01T00:00:00Z");
    const validTo = new Date("2020-06-01T06:00:00Z");
    const now = new Date("2020-06-01T02:00:00Z");

    const realValidTo = calculateRealValidTo(seenLast, validTo, now);
    expect(realValidTo).toStrictEqual(validTo);
  });

  test("should use seen_last if past timeframe", ({ expect }) => {
    const seenLast = new Date("2020-06-01T00:00:00Z");
    const validTo = new Date("2020-06-01T06:00:00Z");
    const now = new Date("2020-06-02T01:00:00Z");

    const realValidTo = calculateRealValidTo(seenLast, validTo, now);
    expect(realValidTo).toStrictEqual(seenLast);
  });
});

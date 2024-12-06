import { toUTCDate } from "@/utils/dateTime";
import { describe, expect, it } from "vitest";

describe("dateTime", () => {
  describe("toUTCDate", () => {
    it("should convert a date string to UTC date", () => {
      const date = "2024-03-15T12:00:00.000Z";
      const result = toUTCDate(date);

      expect(result.toISOString()).toBe(date);
    });

    it("should handle Date objects", () => {
      const date = new Date("2024-03-15T12:00:00.000Z");
      const result = toUTCDate(date);

      expect(result.toISOString()).toBe(date.toISOString());
    });
  });
});

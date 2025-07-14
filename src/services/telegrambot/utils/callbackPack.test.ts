import { describe, expect, test } from "vitest";
import { z } from "zod";
import { packData, unpackData } from "./callbackPack";

describe("Callback Pack", () => {
  describe("Basic Types", () => {
    const BasicSchema = z.object({
      str: z.string(),
      num: z.number(),
      nullField: z.null(),
      undefinedField: z.undefined(),
    });

    test("should handle basic types correctly", () => {
      const data = {
        str: "hello",
        num: 123,
        nullField: null,
        undefinedField: undefined,
      };

      const packed = packData(data, BasicSchema);
      const unpacked = unpackData(packed, BasicSchema);

      expect(unpacked).toEqual(data);
    });

    test("should handle various number formats", () => {
      const NumberSchema = z.object({
        integer: z.number(),
        decimal: z.number(),
        negative: z.number(),
        scientific: z.number(),
        zero: z.number(),
      });

      const data = {
        integer: 42,
        decimal: Math.PI,
        negative: -123.456,
        scientific: 1.23e-4,
        zero: 0,
      };

      const packed = packData(data, NumberSchema);
      const unpacked = unpackData(packed, NumberSchema);

      expect(unpacked).toEqual(data);
      expect(typeof unpacked.integer).toBe("number");
      expect(typeof unpacked.decimal).toBe("number");
      expect(typeof unpacked.negative).toBe("number");
      expect(typeof unpacked.scientific).toBe("number");
      expect(typeof unpacked.zero).toBe("number");
    });

    test("should handle floating point numbers", () => {
      const data = {
        str: "test",
        num: 123.456,
        nullField: null,
        undefinedField: undefined,
      };

      const packed = packData(data, BasicSchema);
      const unpacked = unpackData(packed, BasicSchema);

      expect(unpacked).toEqual(data);
    });

    test("should handle negative numbers", () => {
      const data = {
        str: "test",
        num: -123.456,
        nullField: null,
        undefinedField: undefined,
      };

      const packed = packData(data, BasicSchema);
      const unpacked = unpackData(packed, BasicSchema);

      expect(unpacked).toEqual(data);
    });
  });

  describe("String Escaping", () => {
    const EscapeSchema = z.object({
      value: z.string(),
    });

    test("should escape colons in strings", () => {
      const data = { value: "hello:world" };
      const packed = packData(data, EscapeSchema);

      expect(packed).toContain("\\:");

      const unpacked = unpackData(packed, EscapeSchema);
      expect(unpacked).toEqual(data);
    });

    test("should escape backslashes", () => {
      const data = { value: "hello\\world" };
      const packed = packData(data, EscapeSchema);

      expect(packed).toContain("\\\\");

      const unpacked = unpackData(packed, EscapeSchema);
      expect(unpacked).toEqual(data);
    });

    test("should escape the word 'null' when it appears as a string", () => {
      const data = { value: "null" };
      const packed = packData(data, EscapeSchema);

      expect(packed).toBe("\\null");

      const unpacked = unpackData(packed, EscapeSchema);
      expect(unpacked).toEqual(data);
    });

    test("should escape the word 'true' when it appears as a string", () => {
      const data = { value: "true" };
      const packed = packData(data, EscapeSchema);

      expect(packed).toBe("\\true");

      const unpacked = unpackData(packed, EscapeSchema);
      expect(unpacked).toEqual(data);
    });

    test("should escape the word 'false' when it appears as a string", () => {
      const data = { value: "false" };
      const packed = packData(data, EscapeSchema);

      expect(packed).toBe("\\false");

      const unpacked = unpackData(packed, EscapeSchema);
      expect(unpacked).toEqual(data);
    });

    test("should escape the word 'undef' when it appears as a string", () => {
      const data = { value: "undef" };
      const packed = packData(data, EscapeSchema);

      expect(packed).toBe("\\undef");

      const unpacked = unpackData(packed, EscapeSchema);
      expect(unpacked).toEqual(data);
    });

    test("should handle multiple escapes in the same string", () => {
      const data = { value: "hello:world\\with:many:special\\chars" };
      const packed = packData(data, EscapeSchema);
      const unpacked = unpackData(packed, EscapeSchema);

      expect(unpacked).toEqual(data);
    });
  });

  describe("Enums", () => {
    enum TestEnum {
      One = "ONE",
      Two = "TWO",
    }

    const EnumSchema = z.object({
      enumValue: z.enum(TestEnum),
    });

    test("should handle enum values", () => {
      const data = { enumValue: TestEnum.One };
      const packed = packData(data, EnumSchema);
      const unpacked = unpackData(packed, EnumSchema);

      expect(unpacked).toEqual(data);
    });

    test("should handle all enum values", () => {
      for (const enumValue of Object.values(TestEnum)) {
        const data = { enumValue };
        const packed = packData(data, EnumSchema);
        const unpacked = unpackData(packed, EnumSchema);

        expect(unpacked).toEqual(data);
      }
    });
  });

  describe("Boolean Support", () => {
    const BooleanSchema = z.object({
      flag: z.boolean(),
      nullableFlag: z.boolean().nullable(),
      optionalFlag: z.boolean().optional(),
      str: z.string(),
    });

    test("should handle basic boolean values", () => {
      const data = {
        flag: true,
        nullableFlag: false,
        optionalFlag: true,
        str: "test",
      };

      const packed = packData(data, BooleanSchema);
      const unpacked = unpackData(packed, BooleanSchema);

      expect(unpacked).toEqual(data);
      expect(typeof unpacked.flag).toBe("boolean");
      expect(typeof unpacked.nullableFlag).toBe("boolean");
      expect(typeof unpacked.optionalFlag).toBe("boolean");
    });

    test("should handle nullable and optional boolean values", () => {
      const data = {
        flag: false,
        nullableFlag: null,
        optionalFlag: undefined,
        str: "test",
      };

      const packed = packData(data, BooleanSchema);
      const unpacked = unpackData(packed, BooleanSchema);

      expect(unpacked).toEqual(data);
    });

    test("should escape the words 'true' and 'false' when they appear as strings", () => {
      const StringSchema = z.object({
        value: z.string(),
      });

      const testCases = [
        { value: "true" },
        { value: "false" },
        { value: "some:true:text" },
        { value: "some:false:text" },
      ];

      for (const data of testCases) {
        const packed = packData(data, StringSchema);
        const unpacked = unpackData(packed, StringSchema);
        expect(unpacked).toEqual(data);
      }
    });

    test("should throw on invalid boolean values", () => {
      const packed = "invalid:null:undef:test";
      expect(() => unpackData(packed, BooleanSchema)).toThrow(
        /Invalid boolean/,
      );
    });
  });

  describe("Schema Validation", () => {
    const ValidationSchema = z.object({
      id: z.number().positive(),
      email: z.email(),
      status: z.enum(["active", "inactive"]),
    });

    test("should validate data during packing", () => {
      const invalidData = {
        id: -1,
        email: "not-an-email",
        status: "active",
      };

      // Use "as z.infer" to bypass TypeScript type checking
      expect(() =>
        packData(
          invalidData as z.infer<typeof ValidationSchema>,
          ValidationSchema,
        ),
      ).toThrow();
    });

    test("should validate data during unpacking", () => {
      // Create valid data first
      const validData = {
        id: 1,
        email: "test@example.com",
        status: "active" as const,
      };
      const packed = packData(validData, ValidationSchema);

      // Manually corrupt the packed string
      const corruptedPacked = packed.replace(
        "test@example.com",
        "not-an-email",
      );

      expect(() => unpackData(corruptedPacked, ValidationSchema)).toThrow();
    });

    test("should allow valid data", () => {
      const validData = {
        id: 1,
        email: "test@example.com",
        status: "active" as const,
      };

      const packed = packData(validData, ValidationSchema);
      const unpacked = unpackData(packed, ValidationSchema);

      expect(unpacked).toEqual(validData);
    });
  });

  describe("Type Coercion", () => {
    const CoercionSchema = z.object({
      numberLike: z.string(),
      actualNumber: z.coerce.number(),
    });

    test("should respect schema types without premature coercion", () => {
      const data = {
        numberLike: "123", // Should stay a string
        actualNumber: 123, // Should be a number
      };

      const packed = packData(data, CoercionSchema);
      const unpacked = unpackData(packed, CoercionSchema);

      expect(typeof unpacked.numberLike).toBe("string");
      expect(typeof unpacked.actualNumber).toBe("number");
      expect(unpacked).toEqual(data);
    });
  });

  describe("Edge Cases and Advanced Schema Validation", () => {
    describe("String Edge Cases", () => {
      const emptySchema = z.object({
        field1: z.string(),
        field2: z.string(),
      });

      test("should handle empty strings", () => {
        const packed = ":";
        const unpacked = unpackData(packed, emptySchema);
        expect(unpacked).toEqual({
          field1: "",
          field2: "",
        });
      });

      test("should preserve whitespace", () => {
        const data = {
          field1: " ",
          field2: "  ",
        };

        const packed = packData(data, emptySchema);
        const unpacked = unpackData(packed, emptySchema);

        expect(unpacked).toEqual(data);
      });

      test("should handle consecutive colons in input", () => {
        const data = {
          field1: ":",
          field2: "::",
        };

        const packed = packData(data, emptySchema);
        const unpacked = unpackData(packed, emptySchema);
        expect(unpacked).toEqual(data);
      });
    });

    describe("Number Handling", () => {
      const NumberSchema = z.object({
        integer: z.number(),
        stringNumber: z.string(),
        optionalNumber: z.number().optional(),
        nullableNumber: z.number().nullable(),
        refinedNumber: z.number().min(0).max(100),
      });

      test("should keep string numbers as strings when schema expects string", () => {
        const data = {
          integer: 42,
          stringNumber: "123",
          optionalNumber: undefined,
          nullableNumber: null,
          refinedNumber: 50,
        };
        const packed = packData(data, NumberSchema);
        const unpacked = unpackData(packed, NumberSchema);
        expect(typeof unpacked.stringNumber).toBe("string");
      });

      test("should validate refined numbers", () => {
        const invalidData = {
          integer: 42,
          stringNumber: "123",
          optionalNumber: undefined,
          nullableNumber: null,
          refinedNumber: 101, // Over max
        };
        expect(() => packData(invalidData, NumberSchema)).toThrow();
      });
    });

    describe("String Escaping", () => {
      const EscapeSchema = z.object({
        value: z.string(),
      });

      interface TestCase {
        input: string;
        expectedPacked: string;
      }

      const testCases: TestCase[] = [
        {
          input: ":",
          expectedPacked: "\\:", // Simple colon should be escaped
        },
        {
          input: "\\",
          expectedPacked: "\\\\", // Single backslash should be escaped
        },
        {
          input: "\\:",
          expectedPacked: "\\\\\\:", // Backslash-colon should have both escaped
        },
        {
          input: ":",
          expectedPacked: "\\:", // Colon should be escaped
        },
        {
          input: "null",
          expectedPacked: "\\null", // Special value should be escaped when it's content
        },
        {
          input: "undef",
          expectedPacked: "\\undef", // Special value should be escaped when it's content
        },
      ];

      for (const { input, expectedPacked } of testCases) {
        test(`should correctly handle "${input}" through pack/unpack cycle`, () => {
          // Test packing
          const packed = packData({ value: input }, EscapeSchema);
          console.log("packed", packed);
          expect(packed).toBe(expectedPacked);

          // Test unpacking
          const unpacked = unpackData(packed, EscapeSchema);
          expect(unpacked.value).toBe(input);
        });
      }
    });

    describe("Schema Inheritance", () => {
      const BaseSchema = z.object({
        id: z.number(),
        name: z.string(),
      });

      const ExtendedSchema = BaseSchema.extend({
        age: z.number(),
        email: z.email(),
      });

      test("should handle extended schemas", () => {
        const data = {
          id: 1,
          name: "Test",
          age: 25,
          email: "test@example.com",
        };
        const packed = packData(data, ExtendedSchema);
        const unpacked = unpackData(packed, ExtendedSchema);
        expect(unpacked).toEqual(data);
      });
    });

    describe("Error Handling", () => {
      const ErrorSchema = z.object({
        num: z.number(),
        str: z.string(),
      });

      test("should throw descriptive error for invalid number fields", () => {
        const packed = "not-a-number:test";
        expect(() => unpackData(packed, ErrorSchema)).toThrow(/Invalid number/);
      });

      test("should preserve original error messages from Zod", () => {
        const ValidationSchema = z.object({
          email: z.email(),
          age: z.number().min(18),
        });

        const data = {
          email: "not-an-email",
          age: 15,
        };

        expect(() => packData(data, ValidationSchema)).toThrow(
          /Invalid email|Number must be greater than/,
        );
      });
    });

    describe("Boundary Conditions", () => {
      const BoundarySchema = z.object({
        num: z.number(),
        str: z.string(),
      });

      test("should handle numeric edge cases", () => {
        const testCases = [
          { num: Number.MAX_SAFE_INTEGER, str: "max" },
          { num: Number.MIN_SAFE_INTEGER, str: "min" },
        ];

        for (const testCase of testCases) {
          const packed = packData(testCase, BoundarySchema);
          console.log("packed", packed);
          const unpacked = unpackData(packed, BoundarySchema);
          expect(unpacked).toEqual(testCase);
          expect(Object.is(unpacked.num, testCase.num)).toBe(true); // Handles -0 vs 0
        }
      });

      test("should reject invalid numeric values", () => {
        const invalidValues = ["NaN", "Infinity", "-Infinity"];

        for (const invalid of invalidValues) {
          const packed = `${invalid}:test`;
          expect(() => unpackData(packed, BoundarySchema)).toThrow();
        }
      });
    });
  });

  describe("Error Cases", () => {
    const ErrorSchema = z.object({
      field1: z.string(),
      field2: z.number(),
    });

    test("should throw on incorrect number of fields", () => {
      const packed = "value1:123:extra";
      expect(() => unpackData(packed, ErrorSchema)).toThrow();
    });

    test("should throw on invalid field values", () => {
      const invalidData = {
        field1: "valid",
        field2: {} as number, // Type assertion to bypass TypeScript
      };

      expect(() => packData(invalidData, ErrorSchema)).toThrow();
    });

    test("should throw on missing fields", () => {
      const packed = "value1";
      expect(() => unpackData(packed, ErrorSchema)).toThrow();
    });
  });

  describe("Optional Fields", () => {
    const OptionalSchema = z.object({
      required: z.string(),
      optional: z.string().optional(),
      nullable: z.string().nullable(),
      nullableOptional: z.string().nullable().optional(),
    });

    test("should handle optional fields", () => {
      const data = {
        required: "value",
        optional: undefined,
        nullable: null,
        nullableOptional: undefined,
      };

      const packed = packData(data, OptionalSchema);
      const unpacked = unpackData(packed, OptionalSchema);

      expect(unpacked).toEqual(data);
    });

    test("should handle all combinations of optional and nullable", () => {
      const testCases = [
        {
          required: "value",
          optional: "defined",
          nullable: "defined",
          nullableOptional: "defined",
        },
        {
          required: "value",
          optional: undefined,
          nullable: null,
          nullableOptional: undefined,
        },
        {
          required: "value",
          optional: "defined",
          nullable: null,
          nullableOptional: null,
        },
      ];

      for (const testCase of testCases) {
        const packed = packData(testCase, OptionalSchema);
        const unpacked = unpackData(packed, OptionalSchema);
        expect(unpacked).toEqual(testCase);
      }
    });
  });

  describe("Integration Tests", () => {
    const basicSchema = z.object({
      name: z.string(),
      id: z.string(),
    });

    test("should round-trip complex data correctly", () => {
      const testCases = [
        {
          name: "John:Doe:\\Test",
          id: "123:456\\789",
        },
        {
          name: "",
          id: ":::",
        },
        {
          name: "   ",
          id: "\\:\\:",
        },
      ];

      for (const data of testCases) {
        const packed = packData(data, basicSchema);
        const unpacked = unpackData(packed, basicSchema);
        expect(unpacked).toEqual(data);
      }
    });
  });
});

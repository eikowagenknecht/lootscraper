import { z } from "zod";

/**
 * Represents a value that can be converted to a string using valueOf()
 * Typically used for enums or other string-like types
 */
interface EnumValue {
  valueOf(): string;
}

/**
 * Represents all valid field values that can be serialized
 * - string: Regular strings (will be escaped if containing special characters)
 * - EnumValue: Enum values or objects with string valueOf()
 * - number: Both integers and floating point numbers
 * - null: Represented as "null" in the packed string
 * - undefined: Represented as "undef" in the packed string
 */
type ValidFieldValue = string | EnumValue | number | null | undefined;

/**
 * Special marker used to represent null values in the packed string
 * @internal
 */
const SPECIAL_NULL = "null";

/**
 * Special marker used to represent undefined values in the packed string
 * @internal
 */
const SPECIAL_UNDEFINED = "undef";

/**
 * Type guard to check if a value is valid for serialization
 * @param value - The value to check
 * @returns True if the value can be serialized, false otherwise
 * @internal
 */
function isValidFieldValue(value: unknown): value is ValidFieldValue {
  if (value === null || value === undefined) return true;
  if (typeof value === "number") return true;
  if (typeof value === "string") return true;
  if (typeof value !== "object") return false;
  return (
    "valueOf" in value &&
    typeof (value as { valueOf: unknown }).valueOf === "function" &&
    typeof (value as EnumValue).valueOf() === "string"
  );
}

/**
 * Escapes special characters in a string value
 * @param value - The string to escape
 * @returns The escaped string
 * @internal
 */
const escapeValue = (value: string): string => {
  // Escape the escape character first to avoid double escaping
  let escaped = value.replace(/\\/g, "\\\\");
  // Escape colons after backslashes are escaped
  escaped = escaped.replace(/:/g, "\\:");
  // Escape special values when they appear as exact matches
  if (escaped === SPECIAL_NULL || escaped === SPECIAL_UNDEFINED) {
    escaped = `\\${escaped}`;
  }
  return escaped;
};

/**
 * Unescapes special characters in a string value
 * @param value - The string to unescape
 * @returns The unescaped string
 * @internal
 */
const unescapeValue = (value: string): string => {
  // Handle special values first
  if (value === SPECIAL_NULL || value === SPECIAL_UNDEFINED) {
    return value;
  }

  // Handle escaped special values
  if (value.startsWith("\\") && value.length > 1) {
    const unescaped = value.slice(1);
    if (unescaped === SPECIAL_NULL || unescaped === SPECIAL_UNDEFINED) {
      return unescaped;
    }
  }

  let result = value;
  let match: RegExpExecArray | null;
  const pattern = /\\(\\|:)/g;
  const replacements: [number, string][] = [];

  // Find all escape sequences and store their positions
  match = pattern.exec(result);
  while (match !== null) {
    replacements.push([match.index, match[1]]);
    match = pattern.exec(result);
  }

  // Replace escape sequences from right to left to maintain positions
  for (let i = replacements.length - 1; i >= 0; i--) {
    const [pos, char] = replacements[i];
    result = result.slice(0, pos) + char + result.slice(pos + 2);
  }

  return result;
};

/**
 * Serializes a field value to string
 * @param value - The value to serialize
 * @returns The serialized string
 * @internal
 */
function serializeValue(value: ValidFieldValue): string {
  if (value === null) return SPECIAL_NULL;
  if (value === undefined) return SPECIAL_UNDEFINED;
  if (typeof value === "number") {
    if (Number.isNaN(value)) {
      throw new Error("Number value must not be NaN");
    }
    if (!Number.isFinite(value)) {
      throw new Error("Number value must be finite");
    }
    return value.toString();
  }
  if (typeof value === "string") return escapeValue(value);
  return escapeValue(value.valueOf());
}

/**
 * Packs an object into a colon-delimited string
 *
 * @param data - The object to pack
 * @param schema - Optional Zod schema for validation
 * @returns The packed string
 * @throws {Error} If any value is not a valid field value
 * @throws {ZodError} If the data doesn't match the schema
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   userId: z.number(),
 *   status: z.enum(["active", "inactive"]),
 *   email: z.string().nullable(),
 * });
 *
 * const data = {
 *   userId: 123,
 *   status: "active",
 *   email: null,
 * };
 *
 * const packed = packData(data, schema);
 * // Result: "123:active:null"
 * ```
 */
export function packData<T extends z.ZodObject<z.ZodRawShape>>(
  data: z.infer<T>,
  schema?: T,
): string {
  if (schema !== undefined) {
    schema.parse(data);
  }

  const fields = Object.keys(data) as (keyof z.infer<T>)[];
  return fields
    .map((field) => {
      const value = data[field];
      if (!isValidFieldValue(value)) {
        throw new Error(
          `Value for field ${String(field)} must be a string, number, null, undefined, or string enum`,
        );
      }
      return serializeValue(value);
    })
    .join(":");
}

/**
 * Unpacks a colon-delimited string into an object according to the provided schema
 *
 * @param packed - The packed string to unpack
 * @param schema - Zod schema defining the expected structure
 * @returns The unpacked and validated object
 * @throws {Error} If the number of fields doesn't match the schema
 * @throws {ZodError} If the unpacked data doesn't match the schema
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   userId: z.number(),
 *   status: z.enum(["active", "inactive"]),
 *   email: z.string().nullable(),
 * });
 *
 * const packed = "123:active:null";
 * const unpacked = unpackData(packed, schema);
 * // Result: { userId: 123, status: "active", email: null }
 * ```
 */
export function unpackData<T extends z.ZodObject<z.ZodRawShape>>(
  packed: string,
  schema: T,
): z.infer<T> {
  const keys = Object.keys(schema.shape) as (keyof z.infer<T>)[];
  const regex = /(?<!\\):/;
  const values = packed.split(regex);

  if (values.length !== keys.length) {
    throw new Error(
      `Expected ${keys.length.toFixed()} fields but got ${values.length.toFixed()}`,
    );
  }

  const data = Object.fromEntries(
    keys.map((field, index) => {
      const value = values[index] ?? "";
      const fieldSchema = (
        schema.shape as Record<keyof z.infer<T>, z.ZodTypeAny>
      )[field];

      // Check if the field schema expects a number (handles nullable/optional)
      if (fieldSchema.isNullable() && value === SPECIAL_NULL)
        return [field, null];
      if (fieldSchema.isOptional() && value === SPECIAL_UNDEFINED)
        return [field, undefined];

      // Get the innermost schema type (unwraps nullable/optional)
      function unwrapSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
        if (schema instanceof z.ZodNullable) {
          return unwrapSchema(schema.unwrap() as z.ZodTypeAny);
        }
        if (schema instanceof z.ZodOptional)
          return unwrapSchema(schema.unwrap() as z.ZodTypeAny);
        return schema;
      }

      const innerSchema = unwrapSchema(fieldSchema);
      const unescaped = unescapeValue(value);

      // Check if the field schema expects a number
      if (innerSchema instanceof z.ZodNumber) {
        const num = Number(unescaped);
        if (Number.isNaN(num)) {
          throw new Error(
            `Invalid number value for field ${String(field)}: ${unescaped}`,
          );
        }
        if (!Number.isFinite(num)) {
          throw new Error(
            `Number value for field ${String(field)} is not finite: ${unescaped}`,
          );
        }
        return [field, num];
      }

      return [field, unescaped];
    }),
  ) as z.infer<T>;

  return schema.parse(data);
}

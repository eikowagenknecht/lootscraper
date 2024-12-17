// TODO: Maybe export this as a npm package.
import type { z } from "zod";

/**
 * Type for field values that must be either string or string enum
 */
interface StringEnumValue {
  valueOf(): string;
}

type ValidFieldValue = string | StringEnumValue;

type ValidDataType<T> = {
  [K in keyof T]: T[K] extends ValidFieldValue ? T[K] : never;
};

/**
 * Type guard to check if a value is a valid field value
 */
function isValidFieldValue(value: unknown): value is ValidFieldValue {
  if (typeof value === "string") return true;
  if (typeof value !== "object" || value === null) return false;
  return (
    "valueOf" in value &&
    typeof (value as { valueOf: unknown }).valueOf === "function" &&
    typeof (value as StringEnumValue).valueOf() === "string"
  );
}

/**
 * Escapes colons in a string value
 */
const escapeValue = (value: string): string => value.replace(/:/g, "\\:");

/**
 * Unescapes colons in a string value
 */
const unescapeValue = (value: string): string => value.replace(/\\:/g, ":");

/**
 * Options for packing data
 */
interface PackOptions<T> {
  /**
   * Zod schema for validation
   */
  schema?: z.ZodType<T & ValidDataType<T>>;
  /**
   * Order of fields to pack (optional, defaults to Object.keys order)
   */
  fieldOrder?: readonly (keyof T)[];
}

/**
 * Packs an object into a string
 */
export function packData<T extends object>(
  data: T,
  options?: PackOptions<T>,
): string {
  const fields = options?.fieldOrder ?? (Object.keys(data) as (keyof T)[]);

  if (options?.schema) {
    options.schema.parse(data);
  }

  return fields
    .map((field) => {
      const value = data[field];
      if (!isValidFieldValue(value)) {
        throw new Error(
          `Value for field ${String(field)} must be a string or string enum`,
        );
      }
      const stringValue = typeof value === "string" ? value : value.valueOf();
      return escapeValue(stringValue);
    })
    .join(":");
}

/**
 * Unpacks a string into an object
 */
export function unpackData<T extends object>(
  packed: string,
  options: Omit<PackOptions<T>, "schema"> & {
    schema: z.ZodType<T & ValidDataType<T>>;
  },
): T {
  const fields = options.fieldOrder ?? [];
  const regex = /(?<!\\):/;
  const values = packed.split(regex);

  if (fields.length > 0 && values.length !== fields.length) {
    throw new Error(
      `Invalid packed data: expected ${fields.length.toFixed()} fields, got ${values.length.toFixed()}`,
    );
  }

  const data = Object.fromEntries(
    fields.map((field, index) => {
      const value = values[index];
      return [field, unescapeValue(value)];
    }),
  ) as T;

  return options.schema.parse(data);
}

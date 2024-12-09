/**
 * Recursively remove all null and undefined values from objects and arrays
 * @param value - The object or array to clean
 * @returns A new object or array with null/undefined values removed
 */
export function cleanNulls<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.filter((x) => x != null).map(cleanNulls) as T;
  }

  if (value && typeof value === "object") {
    const cleaned: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(value)) {
      if (val != null) {
        cleaned[key] = cleanNulls(val);
      }
    }

    return cleaned as T;
  }

  return value;
}

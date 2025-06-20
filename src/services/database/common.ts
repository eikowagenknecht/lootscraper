import type { InsertResult, UpdateResult } from "kysely";
import { DatabaseError } from "@/types/errors";

export function handleError(operation: string, error: unknown): never {
  throw new DatabaseError(
    `Failed to ${operation}: ${error instanceof Error ? error.message : String(error)}`,
  );
}

export function handleInsertResult(result: InsertResult): number {
  if (result.insertId === undefined) {
    throw new DatabaseError("Failed to insert record");
  }

  return Number(result.insertId);
}

export function handleUpdateResult(result: UpdateResult): void {
  if (Number(result.numUpdatedRows) === 0) {
    throw new DatabaseError("Failed to update record");
  }
}

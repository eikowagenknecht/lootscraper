import type { Database } from "@/types/database";
import { DatabaseError } from "@/types/errors";
import type { InsertResult, Kysely, UpdateResult } from "kysely";

export abstract class BaseRepository {
  constructor(protected readonly db: Kysely<Database>) {}

  protected handleError(operation: string, error: unknown): never {
    throw new DatabaseError(
      `Failed to ${operation}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  protected handleInsertResult(result: InsertResult): number {
    if (result.insertId === undefined) {
      throw new DatabaseError("Failed to insert record");
    }

    return Number(result.insertId);
  }

  protected handleUpdateResult(result: UpdateResult): void {
    if (Number(result.numUpdatedRows) === 0) {
      throw new DatabaseError("Failed to update record");
    }
  }
}

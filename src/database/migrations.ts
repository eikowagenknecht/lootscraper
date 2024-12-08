import type { Database } from "@/types/database";
import { DatabaseError } from "@/types/errors";
import { logger } from "@/utils/logger";
// src/database/migrations.ts
import { type Kysely, type Migration, Migrator } from "kysely";
import { initialMigration } from "./migrations/001_initial";

// Define the migrations type
const migrations: Record<string, Migration> = {
  "001_initial": initialMigration,
};

export async function migrateToLatest(db: Kysely<Database>): Promise<void> {
  const migrator = new Migrator({
    db,
    provider: {
      getMigrations: () => Promise.resolve(migrations),
    },
  });

  try {
    const { error, results } = await migrator.migrateToLatest();

    if (error) {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      throw new DatabaseError(`Failed to migrate: ${String(error)}`);
    }

    if (results?.length) {
      for (const migration of results) {
        logger.info(`Migration "${migration.migrationName}" completed`);
      }
    }
  } catch (error) {
    throw new DatabaseError(
      `Migration error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

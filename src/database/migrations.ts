import { DatabaseError } from "@/types/errors";
import { logger } from "@/utils/logger";
import { type Kysely, type Migration, Migrator } from "kysely";
import { initialMigration } from "./migrations/2024-12-08-initial";
import { dropAlembicMigration } from "./migrations/2024-12-09-drop-alembic";
import { indicesMigration } from "./migrations/2024-12-10-indices";

// Define the migrations type
const migrations: Record<string, Migration> = {
  "2024-12-08-initial": initialMigration,
  "2024-12-09-drop-alembic": dropAlembicMigration,
  "2024-12-10-indices": indicesMigration,
};

export async function migrateToLatest(db: Kysely<unknown>): Promise<void> {
  logger.info("Migrating database to latest version");

  const hasExistingTables = await checkForExistingTables(db);
  const hasMigrationTable = await db.introspection
    .getTables()
    .then((tables) =>
      tables.some((table) => table.name === "kysely_migration"),
    );

  // For existing databases from a pre-Kysely version, add the migration tables
  // and first migration manually to get them up to speed.
  if (hasExistingTables && !hasMigrationTable) {
    await db.schema
      .createTable("kysely_migration")
      .addColumn("name", "varchar(255)", (col) => col.primaryKey())
      .addColumn("timestamp", "varchar(255)", (col) => col.notNull())
      .execute();
    await db.schema
      .createTable("kysely_migration_lock")
      .addColumn("id", "varchar(255)", (col) => col.primaryKey())
      .addColumn("is_locked", "integer", (col) => col.notNull())
      .execute();

    // Mark the initial migration as applied
    await db
      .insertInto("kysely_migration" as never)
      .values({
        name: "2024-12-08-initial",
        timestamp: new Date().toISOString(),
      })
      .execute();
  }

  const migrator = new Migrator({
    db,
    provider: {
      getMigrations: () => Promise.resolve(migrations),
    },
  });

  try {
    const { error, results } = await migrator.migrateToLatest();

    if (results !== undefined) {
      for (const migration of results) {
        if (migration.status === "Success") {
          logger.info(
            `Migration "${migration.migrationName}" was executed successfully.`,
          );
        } else if (migration.status === "Error") {
          logger.error(
            `Failed to execute migration "${migration.migrationName}".`,
          );
        }
      }
    }

    if (error) {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      throw new DatabaseError(`Failed to migrate: ${String(error)}`);
    }
  } catch (error) {
    throw new DatabaseError(
      `Migration error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// Helper function to check if database has existing tables
async function checkForExistingTables(db: Kysely<unknown>): Promise<boolean> {
  const tables = await db.introspection.getTables();
  // Filter out Kysely's own tables
  const userTables = tables.filter(
    (table) =>
      !["kysely_migration", "kysely_migration_lock"].includes(table.name),
  );
  return userTables.length > 0;
}

import { DatabaseError } from "@/types/errors";
import { logger } from "@/utils/logger";
import { type Kysely, type Migration, Migrator } from "kysely";
import { DateTime } from "luxon";
import { initialMigration } from "./migrations/001-initial";
import { dropAlembicMigration } from "./migrations/002-alembic";
import { indicesMigration } from "./migrations/003-indices";
import { nullabilityMigration } from "./migrations/004-nullability";
import { strictModeMigration } from "./migrations/005-strict";
import { dateFormatMigration } from "./migrations/006-dateformat";

// Define the migrations type
const migrations: Record<string, Migration> = {
  "001-initial": initialMigration,
  "002-drop-alembic": dropAlembicMigration,
  "003-indices": indicesMigration,
  "004-nullability": nullabilityMigration,
  "005-strict": strictModeMigration,
  "006-dates": dateFormatMigration,
};

export async function migrateToLatest(db: Kysely<unknown>): Promise<void> {
  logger.info("Migrating database to latest version");

  const hasExistingTables = await checkForExistingTables(db);
  const hasMigrationTables = await checkForMigrationTables(db);

  // For existing databases from a pre-Kysely version, add the migration tables
  // and first migration manually to get them up to speed.
  if (hasExistingTables && !hasMigrationTables) {
    logger.info("Adding migration tables to existing database.");

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
        name: "001-initial",
        timestamp: DateTime.now().toISO(),
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
  return tables.length > 0;
}

async function checkForMigrationTables(db: Kysely<unknown>): Promise<boolean> {
  const tables = await db.introspection.getTables({
    withInternalKyselyTables: true,
  });
  // Only look at Kysely's own tables
  logger.info(`Tables: ${tables.map((table) => table.name).join(", ")}`);
  const systemTables = tables.filter((table) =>
    table.name.startsWith("kysely"),
  );
  return systemTables.length > 0;
}

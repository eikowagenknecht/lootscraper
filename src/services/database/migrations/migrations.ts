import { type Kysely, type Migration, Migrator } from "kysely";
import { DateTime } from "luxon";
import { DatabaseError } from "@/types/errors";
import { logger } from "@/utils/logger";
import { initialMigration } from "./001-initial";
import { dropAlembicMigration } from "./002-alembic";
import { indicesMigration } from "./003-indices";
import { nullabilityMigration } from "./004-nullability";
import { strictModeMigration } from "./005-strict";
import { dateFormatMigration as datesMigration } from "./006-dateformat";
import { scrapingRunsMigration } from "./007-scrapingruns";
import { platformMigration } from "./008-platform";
import { fixActiveMigration } from "./009-fixactive";
import { hashesMigration } from "./010-hashes";

// Define the migrations type
const migrations: Record<string, Migration> = {
  "001-initial": initialMigration,
  "002-drop-alembic": dropAlembicMigration,
  "003-indices": indicesMigration,
  "004-nullability": nullabilityMigration,
  "005-strict": strictModeMigration,
  "006-dates": datesMigration,
  "007-scrapingruns": scrapingRunsMigration,
  "008-platform": platformMigration,
  "009-fixactive": fixActiveMigration,
  "010-hashes": hashesMigration,
};

export async function migrateToLatest(db: Kysely<unknown>): Promise<void> {
  logger.verbose("Checking for DB migrations.");

  const hasExistingTables = await checkForExistingTables(db);
  const hasKyselyTables = await checkForKyselyTables(db);

  // For existing databases from a pre-Kysely version, add the migration tables
  // and first migration manually to get them up to speed.
  if (hasExistingTables && !hasKyselyTables) {
    logger.info(
      "You are migrating from the Python database. This can take a while.",
    );

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

    if (error || results === undefined) {
      throw new Error(String(error));
    }

    if (results.length === 0) {
      logger.info("DB is up to date.");
      return;
    }

    for (const migration of results) {
      if (migration.status === "Success") {
        logger.info(
          `DB Migration "${migration.migrationName}" was executed successfully.`,
        );
      } else if (migration.status === "Error") {
        logger.error(
          `Failed to execute DB migration "${migration.migrationName}".`,
        );
      }
    }
  } catch (error) {
    throw new DatabaseError(
      `DB Migration error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// Helper function to check if database has existing tables
async function checkForExistingTables(db: Kysely<unknown>): Promise<boolean> {
  const tables = await db.introspection.getTables();
  return tables.length > 0;
}

async function checkForKyselyTables(db: Kysely<unknown>): Promise<boolean> {
  const tables = await db.introspection.getTables({
    withInternalKyselyTables: true,
  });
  // Only look at Kysely's own tables
  const systemTables = tables.filter((table) =>
    table.name.startsWith("kysely"),
  );
  return systemTables.length > 0;
}

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { migrateToLatest } from "@/database/migrations";
import type { Config } from "@/types/config";
import type { Database as DatabaseType } from "@/types/database";
import { DatabaseError } from "@/types/errors";
import { logger } from "@/utils/logger";
import SQLite from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";

export class DatabaseService {
  private static instance: DatabaseService;
  private db: Kysely<DatabaseType> | null = null;

  private constructor() {
    // Private constructor to prevent instantiation
  }

  public static getInstance(): DatabaseService {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public async initialize(config: Config): Promise<void> {
    try {
      const dbPath = this.getDbPath(config);

      this.db = new Kysely<DatabaseType>({
        dialect: new SqliteDialect({
          database: new SQLite(dbPath),
        }),
      });

      // Run migrations
      await migrateToLatest(this.db as Kysely<unknown>);

      logger.info(`Database initialized at ${dbPath}`);
    } catch (error) {
      throw new DatabaseError(
        `Failed to initialize database: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  public get(): Kysely<DatabaseType> {
    if (!this.db) {
      throw new DatabaseError(
        "Database not initialized. Call initialize() first.",
      );
    }
    return this.db;
  }

  public async destroy(): Promise<void> {
    if (this.db) {
      await this.db.destroy();
      this.db = null;
    }
  }

  private getDbPath(config: Config): string {
    // Check for Docker environment
    const dockerPath = "/data/";
    if (existsSync(dockerPath)) {
      return resolve(dockerPath, config.common.databaseFile);
    }

    // Fall back to local path
    return resolve(process.cwd(), "data", config.common.databaseFile);
  }
}

// Export a singleton instance
export const database = DatabaseService.getInstance();

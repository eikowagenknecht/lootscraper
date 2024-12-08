import type { Database } from "@/types/database";
// src/database/migrations/001_initial.ts
import type { Kysely } from "kysely";

export const initialMigration = {
  async up(db: Kysely<Database>): Promise<void> {
    await db.schema
      .createTable("alembic_version")
      .addColumn("version_num", "text", (col) => col.notNull())
      .execute();

    // Add other tables...
    // We can create these tables as needed when we implement each feature
  },

  async down(db: Kysely<Database>): Promise<void> {
    await db.schema.dropTable("alembic_version").execute();
    // Drop other tables...
  },
};

import type { Kysely } from "kysely";

export const dropAlembicMigration = {
  async up(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropTable("alembic_version").execute();
  },
};

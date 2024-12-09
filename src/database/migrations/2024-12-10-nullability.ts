import type { Kysely } from "kysely";

export const nullabilityMigration = {
  async up(db: Kysely<unknown>): Promise<void> {
    // offers table - make seen_first not nullable
    await db.schema
      .alterTable("offers")
      .alterColumn("seen_first", (column) => column.setNotNull())
      .execute();
  },
};

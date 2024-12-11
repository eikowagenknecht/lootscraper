import { logger } from "@/utils/logger";
import { sql } from "kysely";
import type { Kysely } from "kysely";
import { DateTime } from "luxon";

interface Row {
  id: number;
  [key: string]: unknown;
}

export const dateFormatMigration = {
  async up(db: Kysely<unknown>): Promise<void> {
    const toISO = (dateStr: unknown): string | null => {
      if (!dateStr) return null;
      if (typeof dateStr !== "string") throw new Error("Invalid date type.");
      const dt = DateTime.fromSQL(dateStr, { zone: "utc" });
      if (!dt.isValid) {
        const tst = DateTime.fromISO(dateStr);
        if (tst.isValid) {
          logger.debug("Already ISO", dateStr);
          return dateStr;
        }
        throw new Error(`Invalid date: ${dateStr}`);
      }
      logger.debug("Converting date", dateStr, "to", dt.toISO());
      return dt.toISO();
    };

    // Get all rows and update them using raw SQL
    const tables = {
      igdb_info: ["release_date"],
      steam_info: ["release_date"],
      announcements: ["date"],
      offers: ["seen_first", "seen_last", "valid_from", "valid_to"],
      telegram_chats: ["registration_date"],
    };

    for (const [table, columns] of Object.entries(tables)) {
      // Get all rows from the table
      const result = await sql`SELECT * FROM ${sql.raw(table)}`.execute(db);
      const rows = result.rows as Row[];

      // Update each row
      for (const row of rows) {
        const updates = columns
          .map((col) => {
            const newDate = toISO(row[col]);
            return newDate ? `${col} = '${newDate}'` : null;
          })
          .filter(Boolean)
          .join(", ");

        if (updates) {
          await sql`
            UPDATE ${sql.raw(table)}
            SET ${sql.raw(updates)}
            WHERE id = ${row.id}
          `.execute(db);
        }
      }
    }
  },
};

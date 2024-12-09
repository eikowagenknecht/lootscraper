import type {
  Database,
  NewAnnouncement,
  NewOffer,
  Offer,
  OfferUpdate,
} from "@/types/database";
import { DatabaseError } from "@/types/errors";
import type { Kysely } from "kysely";

export class DatabaseOperations {
  constructor(private db: Kysely<Database>) {}

  // Announcement operations
  async createAnnouncement(announcement: NewAnnouncement) {
    try {
      return await this.db
        .insertInto("announcements")
        .values({
          ...announcement,
          // date: sql`datetime(${announcement.date})`,
        })
        .executeTakeFirstOrThrow();
    } catch (error) {
      throw new DatabaseError(
        `Failed to create announcement: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getNewAnnouncements(lastAnnouncementId: number) {
    try {
      return await this.db
        .selectFrom("announcements")
        .where("id", ">", lastAnnouncementId)
        .selectAll()
        .orderBy("id", "asc")
        .execute();
    } catch (error) {
      throw new DatabaseError(
        `Failed to get new announcements: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Offer operations
  private async createOffer(offer: NewOffer) {
    try {
      return await this.db
        .insertInto("offers")
        .values(offer)
        .executeTakeFirstOrThrow();
    } catch (error) {
      throw new DatabaseError(
        `Failed to create offer: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getOfferByTitle(title: string): Promise<Offer | undefined> {
    try {
      return await this.db
        .selectFrom("offers")
        .where("title", "=", title)
        .selectAll()
        .executeTakeFirst();
    } catch (error) {
      throw new DatabaseError(
        `Failed to get offer by title: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async updateOffer(id: number, offer: OfferUpdate) {
    try {
      const result = await this.db
        .updateTable("offers")
        .set(offer)
        .where("id", "=", id)
        .executeTakeFirst();

      if (!result.numUpdatedRows) {
        throw new DatabaseError(`No offer found with ID ${id.toFixed(0)}`);
      }

      return result;
    } catch (error) {
      throw new DatabaseError(
        `Failed to update offer: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async createOrUpdateOffer(offer: NewOffer): Promise<number> {
    try {
      // Find existing offer by unique combination
      const existingOffer = await this.db
        .selectFrom("offers")
        .select(["id"])
        .where("title", "=", offer.title)
        .where("source", "=", offer.source)
        .where("type", "=", offer.type)
        .where("duration", "=", offer.duration)
        .where("category", "=", offer.category)
        .executeTakeFirst();

      if (existingOffer) {
        // Update seen last date
        const result = await this.db
          .updateTable("offers")
          .set({
            seen_last: new Date().toISOString(),
          })
          .where("id", "=", existingOffer.id)
          .executeTakeFirst();

        if (!result.numUpdatedRows) {
          throw new DatabaseError("Failed to update existing offer");
        }

        return existingOffer.id;
      }

      const result = await this.createOffer(offer);

      const insertId = result.insertId;

      if (typeof insertId !== "bigint") {
        throw new DatabaseError("Failed to get inserted offer ID");
      }

      return Number(insertId);
    } catch (error) {
      throw new DatabaseError(
        `Failed to create or update offer: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

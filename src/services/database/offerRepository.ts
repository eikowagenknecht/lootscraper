import type { NewOffer, Offer, OfferUpdate } from "@/types/database";
import { BaseRepository } from "./baseRepository";

export class OfferRepository extends BaseRepository {
  private async create(offer: NewOffer): Promise<number> {
    try {
      const result = await this.db
        .insertInto("offers")
        .values(offer)
        .executeTakeFirstOrThrow();
      return this.handleInsertResult(result);
    } catch (error) {
      this.handleError("create offer", error);
    }
  }

  async getByTitle(title: string): Promise<Offer | undefined> {
    try {
      return await this.db
        .selectFrom("offers")
        .where("title", "=", title)
        .selectAll()
        .executeTakeFirst();
    } catch (error) {
      this.handleError("get offer by title", error);
    }
  }

  async update(id: number, offer: OfferUpdate) {
    try {
      const result = await this.db
        .updateTable("offers")
        .set(offer)
        .where("id", "=", id)
        .executeTakeFirst();
      this.handleUpdateResult(result);
      return result;
    } catch (error) {
      this.handleError("update offer", error);
    }
  }

  async createOrUpdate(offer: NewOffer): Promise<number> {
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

      if (existingOffer !== undefined) {
        // Update seen last date
        const result = await this.db
          .updateTable("offers")
          .set({
            seen_last: new Date().toISOString(),
          })
          .where("id", "=", existingOffer.id)
          .executeTakeFirst();
        this.handleUpdateResult(result);
        return existingOffer.id;
      }

      return await this.create(offer);
    } catch (error) {
      this.handleError("create or update offer", error);
    }
  }
}

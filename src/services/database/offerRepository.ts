import type { NewOffer, Offer, OfferUpdate } from "@/types/database";
import { getDb } from "../database";
import { handleError, handleInsertResult, handleUpdateResult } from "./common";

async function createOffer(offer: NewOffer): Promise<number> {
  try {
    const result = await getDb()
      .insertInto("offers")
      .values(offer)
      .executeTakeFirstOrThrow();
    return handleInsertResult(result);
  } catch (error) {
    handleError("create offer", error);
  }
}

export async function getOfferByTitle(
  title: string,
): Promise<Offer | undefined> {
  try {
    return await getDb()
      .selectFrom("offers")
      .where("title", "=", title)
      .selectAll()
      .executeTakeFirst();
  } catch (error) {
    handleError("get offer by title", error);
  }
}

export async function updateOffer(id: number, offer: OfferUpdate) {
  try {
    const result = await getDb()
      .updateTable("offers")
      .set(offer)
      .where("id", "=", id)
      .executeTakeFirst();
    handleUpdateResult(result);
    return result;
  } catch (error) {
    handleError("update offer", error);
  }
}

export async function createOrUpdateOffer(offer: NewOffer): Promise<number> {
  try {
    // Find existing offer by unique combination
    const existingOffer = await getDb()
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
      const result = await getDb()
        .updateTable("offers")
        .set({
          seen_last: new Date().toISOString(),
        })
        .where("id", "=", existingOffer.id)
        .executeTakeFirst();
      handleUpdateResult(result);
      return existingOffer.id;
    }

    return await createOffer(offer);
  } catch (error) {
    handleError("create or update offer", error);
  }
}

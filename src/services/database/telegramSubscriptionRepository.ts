import { getDb } from "@/services/database";
import type { OfferDuration, OfferSource, OfferType } from "@/types/basic";
import type {
  NewTelegramSubscription,
  TelegramSubscription,
  TelegramSubscriptionUpdate,
} from "@/types/database";
import { handleError } from "./common";

export async function getTelegramSubscriptions(
  chatId: number,
): Promise<TelegramSubscription[]> {
  try {
    return await getDb()
      .selectFrom("telegram_subscriptions")
      .selectAll()
      .where("chat_id", "=", chatId)
      .execute();
  } catch (error) {
    handleError("get telegram subscriptions", error);
  }
}

export async function hasTelegramSubscription(
  chatId: number,
  source: OfferSource,
  type: OfferType,
  duration: OfferDuration,
): Promise<boolean> {
  try {
    const result = await getDb()
      .selectFrom("telegram_subscriptions")
      .select(({ fn }) => [fn.count<number>("id").as("count")])
      .where((eb) =>
        eb.and([
          eb("chat_id", "=", chatId),
          eb("source", "=", source),
          eb("type", "=", type),
          eb("duration", "=", duration),
        ]),
      )
      .executeTakeFirst();

    return (result?.count ?? 0) > 0;
  } catch (error) {
    handleError("check telegram subscription", error);
  }
}

export async function createTelegramSubscription(
  subscription: NewTelegramSubscription,
): Promise<void> {
  try {
    await getDb()
      .insertInto("telegram_subscriptions")
      .values(subscription)
      .execute();
  } catch (error) {
    handleError("create telegram subscription", error);
  }
}

export async function updateTelegramSubscription(
  id: number,
  subscription: TelegramSubscriptionUpdate,
) {
  try {
    await getDb()
      .updateTable("telegram_subscriptions")
      .set(subscription)
      .where("id", "=", id)
      .execute();
  } catch (error) {
    handleError("update telegram subscription", error);
  }
}

export async function removeTelegramSubscription(
  chatId: number,
  source: OfferSource,
  type: OfferType,
  duration: OfferDuration,
): Promise<void> {
  try {
    await getDb()
      .deleteFrom("telegram_subscriptions")
      .where((eb) =>
        eb.and([
          eb("chat_id", "=", chatId),
          eb("source", "=", source),
          eb("type", "=", type),
          eb("duration", "=", duration),
        ]),
      )
      .execute();
  } catch (error) {
    handleError("remove telegram subscription", error);
  }
}

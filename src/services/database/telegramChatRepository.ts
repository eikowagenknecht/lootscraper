import { getDb } from "@/services/database";
import type { NewTelegramChat, TelegramChat } from "@/types/database";
import { handleError, handleInsertResult } from "./common";

export async function getTelegramChatById(
  chatId: number,
  threadId?: number | null,
): Promise<TelegramChat | undefined> {
  try {
    let query = getDb()
      .selectFrom("telegram_chats")
      .selectAll()
      .where("id", "=", chatId);

    if (threadId !== undefined) {
      query = query.where("thread_id", "=", threadId);
    }

    return await query.executeTakeFirst();
  } catch (error) {
    handleError("get telegram chat", error);
  }
}

export async function getTelegramChatByChatId(
  chatId: number,
  threadId?: number | null,
): Promise<TelegramChat | undefined> {
  try {
    let query = getDb()
      .selectFrom("telegram_chats")
      .selectAll()
      .where("chat_id", "=", chatId);

    if (threadId !== undefined) {
      query = query.where("thread_id", "=", threadId);
    }

    return await query.executeTakeFirst();
  } catch (error) {
    handleError("get telegram chat", error);
  }
}

export async function getAllActiveTelegramChats(): Promise<TelegramChat[]> {
  try {
    return await getDb()
      .selectFrom("telegram_chats")
      .selectAll()
      .where("active", "=", 1)
      .execute();
  } catch (error) {
    handleError("get all active telegram chats", error);
    return [];
  }
}

export async function createTelegramChat(
  chat: NewTelegramChat,
): Promise<number> {
  try {
    const result = await getDb()
      .insertInto("telegram_chats")
      .values(chat)
      .executeTakeFirstOrThrow();
    return handleInsertResult(result);
  } catch (error) {
    handleError("create telegram chat", error);
  }
}

export async function updateTelegramChatTimezone(
  chatId: number,
  timezoneOffset: number,
): Promise<void> {
  try {
    await getDb()
      .updateTable("telegram_chats")
      .set({ timezone_offset: timezoneOffset })
      .where("chat_id", "=", chatId)
      .executeTakeFirst();
  } catch (error) {
    handleError("update telegram chat timezone", error);
  }
}

export async function updateTelegramChatLastAnnouncementId(
  id: number,
  announcementId: number,
): Promise<void> {
  try {
    await getDb()
      .updateTable("telegram_chats")
      .set({ last_announcement_id: announcementId })
      .where("id", "=", id)
      .executeTakeFirst();
  } catch (error) {
    handleError("update telegram chat last announcement id", error);
  }
}

export async function incrementTelegramChatOffersReceived(
  id: number,
): Promise<void> {
  try {
    await getDb()
      .updateTable("telegram_chats")
      .set((eb) => ({
        offers_received_count: eb("offers_received_count", "+", 1),
      }))
      .where("id", "=", id)
      .executeTakeFirst();
  } catch (error) {
    handleError("increment telegram chat offers received", error);
  }
}

export async function deactivateTelegramChat(
  id: number,
  reason: string,
): Promise<void> {
  try {
    await getDb()
      .updateTable("telegram_chats")
      .set({ active: 0, inactive_reason: reason })
      .where("id", "=", id)
      .executeTakeFirst();
    // TODO: Throw if no rows were updated, slso for the other methods here
  } catch (error) {
    handleError("deactivate telegram chat", error);
  }
}

export async function deleteTelegramChat(id: number): Promise<void> {
  try {
    await getDb()
      .deleteFrom("telegram_chats")
      .where("id", "=", id)
      .executeTakeFirst();
  } catch (error) {
    handleError("delete telegram chat", error);
  }
}

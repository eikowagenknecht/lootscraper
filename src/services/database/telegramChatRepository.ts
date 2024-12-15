import type { NewTelegramChat, TelegramChat } from "@/types/database";
import { getDb } from "../database";
import { handleError, handleInsertResult } from "./common";

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

export async function getTelegramChatById(
  chatId: number,
  threadId?: number | null,
): Promise<TelegramChat | undefined> {
  try {
    const query = getDb()
      .selectFrom("telegram_chats")
      .selectAll()
      .where("chat_id", "=", chatId);

    if (threadId !== undefined) {
      query.where("thread_id", "=", threadId);
    }

    return await query.executeTakeFirst();
  } catch (error) {
    handleError("get telegram chat", error);
  }
}

export async function deactivateTelegramChat(
  chatId: number,
  reason: string,
): Promise<void> {
  try {
    await getDb()
      .updateTable("telegram_chats")
      .set({ active: 0, inactive_reason: reason })
      .where("chat_id", "=", chatId)
      .execute();
  } catch (error) {
    handleError("deactivate telegram chat", error);
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
      .execute();
  } catch (error) {
    handleError("update telegram chat timezone", error);
  }
}

export async function incrementTelegramChatOffersReceived(
  chatId: number,
): Promise<void> {
  try {
    await getDb()
      .updateTable("telegram_chats")
      .set((eb) => ({
        offers_received_count: eb("offers_received_count", "+", 1),
      }))
      .where("chat_id", "=", chatId)
      .execute();
  } catch (error) {
    handleError("increment telegram chat offers received", error);
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

export async function updateTelegramChatLastAnnouncementId(
  chatId: number,
  announcementId: number,
): Promise<void> {
  try {
    await getDb()
      .updateTable("telegram_chats")
      .set({ last_announcement_id: announcementId })
      .where("id", "=", chatId)
      .execute();
  } catch (error) {
    handleError("update telegram chat last announcement id", error);
  }
}

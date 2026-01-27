import { DateTime } from "luxon";
import { insertTestData } from "tests/testData";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { config } from "@/services/config";
import { databaseService } from "@/services/database";
import { ChatType } from "@/types";

import {
  activateTelegramChat,
  createTelegramChat,
  deactivateTelegramChat,
  getAllActiveTelegramChats,
  getTelegramChatById,
  incrementTelegramChatOffersReceived,
  updateTelegramChatLastAnnouncementId,
  updateTelegramChatTimezone,
} from "./telegramChatRepository";

describe("Telegram Chats Repository", () => {
  beforeEach(async () => {
    config.loadConfig();
    await databaseService.initialize(config.get(), true);
    await insertTestData(databaseService.get());
  });

  afterEach(async () => {
    await databaseService.destroy();
  });

  test("should create and get telegram chat", async () => {
    const chat = {
      chat_id: 123,
      registration_date: DateTime.now().toISO(),
      chat_type: ChatType.PRIVATE,
      timezone_offset: 120,
      active: 1,
      offers_received_count: 0,
      last_announcement_id: 0,
    };

    const id = await createTelegramChat(chat);
    expect(id).toBeGreaterThan(0);

    const retrieved = await getTelegramChatById(id);
    expect(retrieved).toMatchObject(chat);
  });

  test("should get active chats", async () => {
    const chats = await getAllActiveTelegramChats();
    expect(chats.every((chat) => chat.active === 1)).toBe(true);
  });

  test("should handle deactivation and activation", async () => {
    const chat = {
      chat_id: 456,
      registration_date: DateTime.now().toISO(),
      chat_type: ChatType.PRIVATE,
      timezone_offset: 120,
      active: 1,
      offers_received_count: 0,
      last_announcement_id: 0,
    };

    const id = await createTelegramChat(chat);
    await deactivateTelegramChat(id, "test reason");

    let retrieved = await getTelegramChatById(id);

    if (!retrieved) {
      throw new Error("Chat not found");
    }

    expect(retrieved.active).toBe(0);
    expect(retrieved.inactive_reason).toBe("test reason");

    await activateTelegramChat(id);
    retrieved = await getTelegramChatById(id);

    if (!retrieved) {
      throw new Error("Chat not found");
    }

    expect(retrieved.active).toBe(1);
    expect(retrieved.inactive_reason).toBeNull();
  });

  test("should update chat properties", async () => {
    const chat = {
      chat_id: 789,
      registration_date: DateTime.now().toISO(),
      chat_type: ChatType.PRIVATE,
      timezone_offset: 120,
      active: 1,
      offers_received_count: 0,
      last_announcement_id: 0,
    };

    const id = await createTelegramChat(chat);

    await updateTelegramChatTimezone(chat.chat_id, 180);
    await updateTelegramChatLastAnnouncementId(id, 5);
    await incrementTelegramChatOffersReceived(id);

    const retrieved = await getTelegramChatById(id);

    if (!retrieved) {
      throw new Error("Chat not found");
    }

    expect(retrieved.timezone_offset).toBe(180);
    expect(retrieved.last_announcement_id).toBe(5);
    expect(retrieved.offers_received_count).toBe(1);
  });

  test("should throw if creating duplicate chat", async () => {
    const chat = {
      chat_id: 123,
      registration_date: DateTime.now().toISO(),
      chat_type: ChatType.PRIVATE,
      timezone_offset: 120,
      active: 1,
      offers_received_count: 0,
      last_announcement_id: 0,
    };

    await createTelegramChat(chat);
    await expect(createTelegramChat(chat)).rejects.toThrow("constraint failed");
  });
});

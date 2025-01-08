import { fail } from "node:assert";
import { telegramBotService } from "@/bot/service";
import { config } from "@/services/config";
import { DateTime } from "luxon";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

describe("Telegram Message Length", () => {
  beforeAll(async () => {
    // Load config and initialize bot
    config.loadConfig();
    await telegramBotService.initialize(config.get());
  });

  afterAll(async () => {
    await telegramBotService.stop();
  });

  test("should fail with longer than 4096 characters", async () => {
    const testChatId = config.get().telegram.botLogChatId; // Use log chat for testing

    // Generate message of 1 over the limit
    const longMessage = generateRandomString(4097);
    console.log(`Generated message length: ${longMessage.length.toFixed()}`);

    try {
      // Try to send the long message
      await telegramBotService
        .getBot()
        .api.sendMessage(testChatId, longMessage);
      fail("Expected message to fail due to length");
    } catch (error) {
      // We expect an error here
      expect(error instanceof Error).toBe(true);
      if (error instanceof Error) {
        expect(error.message).toContain("message is too long");
      }
    }
  });
});

describe("Telegram Rate Limits", () => {
  beforeAll(async () => {
    config.loadConfig();
    await telegramBotService.initialize(config.get());
  });

  afterAll(async () => {
    await telegramBotService.stop();
  });

  test(
    "should handle sequential message sending with delays",
    { timeout: 120000 },
    async () => {
      const TEST_CHAT_ID = config.get().telegram.botLogChatId;

      const messages = Array.from({ length: 30 }, (_, i) => {
        const number = (i + 1).toString().padStart(2, "0");
        return `Sequential message ${number} sent at ${DateTime.now().toFormat("HH:mm:ss.SSS")}`;
      });

      console.log("Starting sequential send test...");
      const startTime = DateTime.now();

      // Send messages with delay between them
      for (const [i, msg] of messages.entries()) {
        try {
          await telegramBotService.getBot().api.sendMessage(TEST_CHAT_ID, msg);
          console.log(`Message ${(i + 1).toFixed()} sent successfully`);
          // Add a small delay between messages
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          console.log(
            `Message ${(i + 1).toFixed()} failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      const endTime = DateTime.now();
      console.log(
        `Test took ${endTime.diff(startTime).toFormat("s.SSS")} seconds`,
      );
    },
  );
});

function generateRandomString(length: number): string {
  return Array.from({ length }, () =>
    String.fromCharCode(Math.floor(Math.random() * 26) + 97),
  ).join("");
}

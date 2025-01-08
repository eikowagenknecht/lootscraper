import { fail } from "node:assert";
import { telegramBotService } from "@/bot/service";
import { config } from "@/services/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("Telegram Message Length", () => {
  beforeAll(async () => {
    // Load config and initialize bot
    config.loadConfig();
    await telegramBotService.initialize(config.get());
  });

  afterAll(async () => {
    await telegramBotService.stop();
  });

  it("should handle messages longer than 4096 characters", async () => {
    const testChatId = config.get().telegram.botLogChatId; // Use log chat for testing

    // Generate message of 5000 characters
    const longMessage = generateRandomString(5000);
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

function generateRandomString(length: number): string {
  // Create paragraphs to make the text more readable
  const paragraphs: string[] = [];
  let remainingLength = length;

  while (remainingLength > 0) {
    // Generate a random paragraph length between 100 and 500 characters
    const paragraphLength = Math.min(
      remainingLength,
      Math.floor(Math.random() * 400) + 100,
    );

    // Generate random text for the paragraph
    const text = Array.from({ length: paragraphLength }, () =>
      String.fromCharCode(Math.floor(Math.random() * 26) + 97),
    ).join("");

    paragraphs.push(text);
    remainingLength -= paragraphLength;
  }

  // Join paragraphs with double newlines
  return paragraphs.join("\n\n");
}

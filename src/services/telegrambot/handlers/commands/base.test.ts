import type { Context } from "grammy";
import { describe, expect, it } from "vitest";

import { isCommandForThisBot } from "./base";

function createContext(text: string | undefined, chatType: string): Context {
  return {
    message: text === undefined ? undefined : { text },
    chat: { type: chatType },
    me: { username: "LootScraperBot" },
  } as unknown as Context;
}

describe("isCommandForThisBot", () => {
  it("accepts an untargeted command in a private chat", () => {
    expect(isCommandForThisBot(createContext("/unknown", "private"))).toBe(true);
  });

  it("ignores an untargeted command in a group", () => {
    expect(isCommandForThisBot(createContext("/unknown", "group"))).toBe(false);
  });

  it("ignores a command addressed to another bot", () => {
    expect(isCommandForThisBot(createContext("/setup@OtherBot", "group"))).toBe(false);
  });

  it("accepts a command addressed to us in a group", () => {
    expect(isCommandForThisBot(createContext("/unknown@LootScraperBot", "supergroup"))).toBe(true);
  });

  it("matches our username case insensitively", () => {
    expect(isCommandForThisBot(createContext("/unknown@lootscraperbot", "group"))).toBe(true);
  });

  it("accepts a targeted command with arguments", () => {
    expect(isCommandForThisBot(createContext("/unknown@LootScraperBot foo bar", "group"))).toBe(
      true,
    );
  });

  it("ignores text that is not a command", () => {
    expect(isCommandForThisBot(createContext("hello /unknown", "private"))).toBe(false);
  });

  it("ignores a message without text", () => {
    expect(isCommandForThisBot(createContext(undefined, "private"))).toBe(false);
  });
});

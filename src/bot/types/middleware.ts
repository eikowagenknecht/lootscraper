import type { CommandsFlavor } from "@grammyjs/commands";
import type { Context } from "grammy";

interface BotInfo {
  developerChatId: number;
  isDeveloper: boolean;
}

export type BotContext = Context & BotInfo & CommandsFlavor;

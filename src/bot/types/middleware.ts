import type { CommandsFlavor } from "@grammyjs/commands";
import type { Context } from "grammy";

interface BotInfo {
  botLogChatId: number;
  isBotOwner: boolean;
}

export type BotContext = Context & BotInfo & CommandsFlavor;

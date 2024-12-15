import type { TelegramChat } from "@/types/database";
import type { Context } from "grammy";

export interface BotContext extends Context {
  dbChat?: TelegramChat;
}

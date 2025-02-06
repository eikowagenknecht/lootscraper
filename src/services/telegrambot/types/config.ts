import type { TelegramLogLevel } from "@/types";

export interface BotConfig {
  accessToken: string;
  botLogChatId: number;
  botOwnerUserId: number;
  logLevel: TelegramLogLevel;
}

export interface BotConfig {
  accessToken: string;
  botLogChatId: number;
  botOwnerUserId: number;
  logLevel: "DISABLED" | "ERROR" | "WARNING" | "INFO" | "DEBUG";
}

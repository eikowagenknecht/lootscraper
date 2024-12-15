export interface BotConfig {
  accessToken: string;
  developerChatId: number;
  adminUserId: number;
  logLevel: "DISABLED" | "ERROR" | "WARNING" | "INFO" | "DEBUG";
}

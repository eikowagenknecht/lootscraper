import { z } from "zod";
import { InfoSource } from "./basic";

// Enums
const LogLevel = z.enum([
  "ERROR",
  "WARN",
  "INFO",
  "HTTP",
  "VERBOSE",
  "DEBUG",
  "SILLY",
]);
type LogLevel = z.infer<typeof LogLevel>;

export const TelegramLogLevel = LogLevel;
export type TelegramLogLevel = z.infer<typeof TelegramLogLevel>;

// Config Schema
export const ConfigSchema = z.object({
  common: z.object({
    databaseFile: z.string().default("loot.db"),
    feedFilePrefix: z.string().default("lootscraper"),
    logFile: z.string().default("lootscraper.log"),
    logLevel: LogLevel.default("INFO"),
  }),
  browser: z.object({
    timeoutSeconds: z.number().default(5),
    headless: z.boolean().default(true),
    loadImages: z.boolean().default(false),
  }),
  scraper: z.object({
    enabledScrapers: z.array(z.string()).default([]),
    infoSources: z.array(z.nativeEnum(InfoSource)).default([]),
  }),
  actions: z.object({
    scrapeOffers: z.boolean().default(false),
    scrapeInfo: z.boolean().default(false),
    generateFeed: z.boolean().default(false),
    uploadToFtp: z.boolean().default(false),
    telegramBot: z.boolean().default(false),
  }),
  telegram: z.object({
    logLevel: TelegramLogLevel.default("ERROR"),
    accessToken: z.string().default(""),
    botLogChatId: z.number().default(0),
    botOwnerUserId: z.number().default(0),
    dropPendingMessages: z.boolean().default(false),
  }),
  igdb: z.object({
    clientId: z.string().default(""),
    clientSecret: z.string().default(""),
  }),
  ftp: z.object({
    host: z.string().default(""),
    user: z.string().default(""),
    password: z.string().default(""),
  }),
  feed: z.object({
    authorName: z.string().default("John Doe"),
    authorEmail: z.string().default("mail@example.com"),
    authorWeb: z.string().default("https://example.com"),
    urlPrefix: z.string().default("https://feed.example.com/"),
    urlAlternate: z.string().default("https://example.com/loot"),
    idPrefix: z.string().default("https://example.com/loot/"),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

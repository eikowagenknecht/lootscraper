import { z } from "zod";
import { OfferDuration, OfferSource, OfferType } from "./basic";

// Enums
export const LogLevel = z.enum([
  "ERROR",
  "WARN",
  "INFO",
  "HTTP",
  "VERBOSE",
  "DEBUG",
  "SILLY",
]);
export type LogLevel = z.infer<typeof LogLevel>;

export const TelegramLogLevel = z.enum([
  "DISABLED",
  "ERROR",
  "WARNING",
  "INFO",
  "DEBUG",
]);
export type TelegramLogLevel = z.infer<typeof TelegramLogLevel>;

export const OfferSourceSchema = z.nativeEnum(OfferSource);
export const OfferTypeSchema = z.nativeEnum(OfferType);
export const OfferDurationSchema = z.nativeEnum(OfferDuration);

// Config Schema
export const ConfigSchema = z.object({
  common: z.object({
    databaseFile: z.string().default("loot.db"),
    feedFilePrefix: z.string().default("lootscraper"),
    logFile: z.string().default("lootscraper.log"),
    logLevel: LogLevel.default("INFO"),
  }),
  expert: z.object({
    dbEcho: z.boolean().default(false),
    webTimeoutSeconds: z.number().default(5),
    headless: z.boolean().default(true),
  }),
  scraper: z.object({
    offerSources: z.array(OfferSourceSchema).default([]),
    offerTypes: z.array(OfferTypeSchema).default([]),
    offerDurations: z.array(OfferDurationSchema).default([]),
    infoSources: z.array(z.enum(["STEAM", "IGDB"])).default([]),
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

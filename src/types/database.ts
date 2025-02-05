import type {
  ColumnType,
  Generated,
  Insertable,
  Selectable,
  Updateable,
} from "kysely";
import type { OfferDuration, OfferSource, OfferType } from "./basic";
import type { ChatType } from "./telegram";

export interface Database {
  alembic_version: AlembicVersionTable;
  announcements: AnnouncementsTable;
  games: GamesTable;
  igdb_info: IgdbInfoTable;
  offers: OffersTable;
  steam_info: SteamInfoTable;
  telegram_chats: TelegramChatsTable;
  telegram_subscriptions: TelegramSubscriptionsTable;
  scraping_runs: ScrapingRunsTable;
}

/** Legacy table from LootScraper <2.0.0 */
interface AlembicVersionTable {
  version_num: string;
}

/** An announcement to be pushed to Telegram users. */
interface AnnouncementsTable {
  id: Generated<number>;
  channel: "TELEGRAM";
  date: ColumnType<string, string | undefined, never>;
  text_markdown: string;
}

export type Announcement = Selectable<AnnouncementsTable>;
export type NewAnnouncement = Insertable<AnnouncementsTable>;
export type AnnouncementUpdate = Updateable<AnnouncementsTable>;

/** A game, links igdb and steam info together. */
interface GamesTable {
  id: Generated<number>;
  igdb_id: number | null;
  steam_id: number | null;
}

export type Game = Selectable<GamesTable>;
export type NewGame = Insertable<GamesTable>;
export type GameUpdate = Updateable<GamesTable>;

/** Information about a game, gathered from IDGB */
interface IgdbInfoTable {
  id: number;
  url: string;
  name: string;
  short_description: string | null;
  release_date: string | null;
  user_score: number | null;
  user_ratings: number | null;
  meta_score: number | null;
  meta_ratings: number | null;
}

export type IgdbInfo = Selectable<IgdbInfoTable>;
export type NewIgdbInfo = Insertable<IgdbInfoTable>;
export type IgdbInfoUpdate = Updateable<IgdbInfoTable>;

/** An offer, can be for a game or some other game related content (loot). */
interface OffersTable {
  id: Generated<number>;
  source: OfferSource;
  type: OfferType;
  duration: OfferDuration;
  title: string;
  probable_game_name: string;
  /** The valid to date as seen on the website. Some websites sometimes remove the offer before this date. */
  seen_last: string;
  rawtext: ColumnType<Record<string, unknown>, string | undefined, string>;
  url: string | null;
  game_id: number | null;
  category: string;
  img_url: string | null;
  seen_first: ColumnType<string, string, never>;
  valid_from: string | null;
  valid_to: string | null;
}

export type Offer = Selectable<OffersTable>;
export type NewOffer = Insertable<OffersTable>;
export type OfferUpdate = Updateable<OffersTable>;

/** Information about a game, gathered from Steam */
interface SteamInfoTable {
  id: number;
  url: string;
  name: string | null;
  short_description: string | null;
  release_date: string | null;
  genres: string | null;
  publishers: string | null;
  image_url: string | null;
  recommendations: number | null;
  percent: number | null;
  score: number | null;
  metacritic_score: number | null;
  metacritic_url: string | null;
  recommended_price_eur: number | null;
}

export type SteamInfo = Selectable<SteamInfoTable>;
export type NewSteamInfo = Insertable<SteamInfoTable>;
export type SteamInfoUpdate = Updateable<SteamInfoTable>;

/** A Telegram chat. Can be a single user, a group or a channel. */
interface TelegramChatsTable {
  id: Generated<number>;
  registration_date: string;
  chat_type: ChatType;
  chat_id: number;
  user_id: number | null;
  thread_id: number | null;
  chat_details: ColumnType<Record<string, unknown>, string | null, string>;
  user_details: ColumnType<Record<string, unknown>, string | null, string>;
  timezone_offset: number;
  active: number;
  inactive_reason: string | null;
  offers_received_count: number;
  last_announcement_id: number;
}

export type TelegramChat = Selectable<TelegramChatsTable>;
export type NewTelegramChat = Insertable<TelegramChatsTable>;
export type TelegramChatUpdate = Updateable<TelegramChatsTable>;

/** Subscription of a chat to a category for Telegram notifications. */
interface TelegramSubscriptionsTable {
  id: Generated<number>;
  chat_id: number;
  source: OfferSource;
  type: OfferType;
  duration: OfferDuration;
  last_offer_id: number;
}

export type TelegramSubscription = Selectable<TelegramSubscriptionsTable>;
export type NewTelegramSubscription = Insertable<TelegramSubscriptionsTable>;
export type TelegramSubscriptionUpdate = Updateable<TelegramSubscriptionsTable>;

/** A list of scraping runs. */
interface ScrapingRunsTable {
  id: Generated<number>;
  scraper: string;
  scheduled_date: string;
  started_date: string | null;
  finished_date: string | null;
  offers_found: number | null;
  offers_new: number | null;
  offers_modified: number | null;
}

export type ScrapingRun = Selectable<ScrapingRunsTable>;
export type NewScrapingRun = Insertable<ScrapingRunsTable>;
export type ScrapingRunUpdate = Updateable<ScrapingRunsTable>;

import type {
  ColumnType,
  Generated,
  Insertable,
  Selectable,
  Updateable,
} from "kysely";
import type { OfferDuration, OfferSource, OfferType } from "./config";

export interface Database {
  alembic_version: AlembicVersionTable;
  announcements: AnnouncementsTable;
  games: GamesTable;
  igdb_info: IgdbInfoTable;
  offers: OffersTable;
  steam_info: SteamInfoTable;
  telegram_chats: TelegramChatsTable;
  telegram_subscriptions: TelegramSubscriptionsTable;
}

interface AlembicVersionTable {
  version_num: string;
}

export type AlembicVersion = Selectable<AlembicVersionTable>;
export type NewAlembicVersion = Insertable<AlembicVersionTable>;
export type AlembicVersionUpdate = Updateable<AlembicVersionTable>;

interface AnnouncementsTable {
  id: Generated<number>;
  channel: "TELEGRAM";
  date: ColumnType<Date, string | undefined, never>;
  text_markdown: string;
}

export type Announcement = Selectable<AnnouncementsTable>;
export type NewAnnouncement = Insertable<AnnouncementsTable>;
export type AnnouncementUpdate = Updateable<AnnouncementsTable>;

interface GamesTable {
  id: Generated<number>;
  igdb_id: number | null;
  steam_id: number | null;
}

export type Game = Selectable<GamesTable>;
export type NewGame = Insertable<GamesTable>;
export type GameUpdate = Updateable<GamesTable>;

interface IgdbInfoTable {
  id: number;
  url: string;
  name: string;
  short_description: string | null;
  release_date: ColumnType<Date, string, string> | null;
  user_score: number | null;
  user_ratings: number | null;
  meta_score: number | null;
  meta_ratings: number | null;
}

export type IgdbInfo = Selectable<IgdbInfoTable>;
export type NewIgdbInfo = Insertable<IgdbInfoTable>;
export type IgdbInfoUpdate = Updateable<IgdbInfoTable>;

interface OffersTable {
  id: Generated<number>;
  source: OfferSource;
  type: OfferType;
  duration: OfferDuration;
  title: string;
  probable_game_name: string;
  seen_last: ColumnType<Date, string, string>;
  rawtext: ColumnType<Record<string, unknown>, string | undefined, string>;
  url: string | null;
  game_id: number | null;
  category: string;
  img_url: string | null;
  seen_first: ColumnType<Date, string, never>;
  valid_from: ColumnType<Date, string, string> | null;
  valid_to: ColumnType<Date, string, string> | null;
}

export type Offer = Selectable<OffersTable>;
export type NewOffer = Insertable<OffersTable>;
export type OfferUpdate = Updateable<OffersTable>;

interface SteamInfoTable {
  id: number;
  url: string;
  name: string | null;
  short_description: string | null;
  release_date: ColumnType<Date, string, string> | null;
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

interface TelegramChatsTable {
  id: Generated<number>;
  registration_date: ColumnType<Date, string, string>;
  chat_type: string;
  chat_id: number;
  user_id: number | null;
  thread_id: number | null;
  chat_details: ColumnType<Record<string, unknown>, string | undefined, string>;
  user_details: ColumnType<Record<string, unknown>, string | undefined, string>;
  timezone_offset: number;
  active: number;
  inactive_reason: string | null;
  offers_received_count: number;
  last_announcement_id: number;
}

export type TelegramChat = Selectable<TelegramChatsTable>;
export type NewTelegramChat = Insertable<TelegramChatsTable>;
export type TelegramChatUpdate = Updateable<TelegramChatsTable>;

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

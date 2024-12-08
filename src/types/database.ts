import type { ColumnType, Generated } from "kysely";

// Enums from your existing types
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

interface AnnouncementsTable {
  id: Generated<number>;
  channel: string;
  date: ColumnType<Date, string, string>;
  text_markdown: string;
}

interface GamesTable {
  id: Generated<number>;
  igdb_id: number | null;
  steam_id: number | null;
}

interface IgdbInfoTable {
  id: number;
  url: string | null;
  name: string | null;
  short_description: string | null;
  release_date: ColumnType<Date, string, string> | null;
  user_score: number | null;
  user_ratings: number | null;
  meta_score: number | null;
  meta_ratings: number | null;
}

interface OffersTable {
  id: Generated<number>;
  source: OfferSource;
  type: OfferType;
  duration: OfferDuration;
  title: string;
  probable_game_name: string;
  seen_last: ColumnType<Date, string, string>;
  rawtext: Record<string, unknown> | null;
  url: string | null;
  game_id: number | null;
  category: string;
  img_url: string | null;
  seen_first: ColumnType<Date, string, string> | null;
  valid_from: ColumnType<Date, string, string> | null;
  valid_to: ColumnType<Date, string, string> | null;
}

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

interface TelegramChatsTable {
  id: Generated<number>;
  registration_date: ColumnType<Date, string, string>;
  chat_type: string;
  chat_id: number;
  user_id: number | null;
  thread_id: number | null;
  chat_details: Record<string, unknown> | null;
  user_details: Record<string, unknown> | null;
  timezone_offset: number;
  active: boolean;
  inactive_reason: string | null;
  offers_received_count: number;
  last_announcement_id: number;
}

interface TelegramSubscriptionsTable {
  id: Generated<number>;
  chat_id: number;
  source: OfferSource;
  type: OfferType;
  duration: OfferDuration;
  last_offer_id: number;
}

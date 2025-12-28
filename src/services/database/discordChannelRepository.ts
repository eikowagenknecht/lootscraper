import { DateTime } from "luxon";
import { getDb } from "@/services/database";
import type {
  OfferDuration,
  OfferPlatform,
  OfferSource,
  OfferType,
} from "@/types/basic";
import type {
  DiscordChannel,
  DiscordChannelUpdate,
  NewDiscordChannel,
} from "@/types/database";
import { handleError } from "./common";

export async function getAllDiscordChannels(): Promise<DiscordChannel[]> {
  try {
    return await getDb().selectFrom("discord_channels").selectAll().execute();
  } catch (error) {
    handleError("get all discord channels", error);
  }
}

export async function getDiscordChannel(
  source: OfferSource,
  type: OfferType,
  duration: OfferDuration,
  platform: OfferPlatform,
): Promise<DiscordChannel | undefined> {
  try {
    return await getDb()
      .selectFrom("discord_channels")
      .selectAll()
      .where((eb) =>
        eb.and([
          eb("source", "=", source),
          eb("type", "=", type),
          eb("duration", "=", duration),
          eb("platform", "=", platform),
        ]),
      )
      .executeTakeFirst();
  } catch (error) {
    handleError("get discord channel", error);
  }
}

export async function getDiscordChannelByChannelId(
  channelId: string,
): Promise<DiscordChannel | undefined> {
  try {
    return await getDb()
      .selectFrom("discord_channels")
      .selectAll()
      .where("channel_id", "=", channelId)
      .executeTakeFirst();
  } catch (error) {
    handleError("get discord channel by channel id", error);
  }
}

export async function createDiscordChannel(
  channelId: string,
  source: OfferSource,
  type: OfferType,
  duration: OfferDuration,
  platform: OfferPlatform,
): Promise<DiscordChannel> {
  try {
    const channel: NewDiscordChannel = {
      channel_id: channelId,
      source,
      type,
      duration,
      platform,
      last_offer_id: 0,
      created_at: DateTime.now().toISO(),
    };

    const result = await getDb()
      .insertInto("discord_channels")
      .values(channel)
      .returningAll()
      .executeTakeFirstOrThrow();

    return result;
  } catch (error) {
    handleError("create discord channel", error);
  }
}

export async function getOrCreateDiscordChannel(
  channelId: string,
  source: OfferSource,
  type: OfferType,
  duration: OfferDuration,
  platform: OfferPlatform,
): Promise<DiscordChannel> {
  const existing = await getDiscordChannel(source, type, duration, platform);
  if (existing) {
    // Update channel ID if it has changed
    if (existing.channel_id !== channelId) {
      await updateDiscordChannel(existing.id, { channel_id: channelId });
      return { ...existing, channel_id: channelId };
    }
    return existing;
  }
  return createDiscordChannel(channelId, source, type, duration, platform);
}

export async function updateDiscordChannel(
  id: number,
  update: DiscordChannelUpdate,
): Promise<void> {
  try {
    await getDb()
      .updateTable("discord_channels")
      .set(update)
      .where("id", "=", id)
      .execute();
  } catch (error) {
    handleError("update discord channel", error);
  }
}

export async function updateDiscordChannelLastOfferId(
  id: number,
  lastOfferId: number,
): Promise<void> {
  await updateDiscordChannel(id, { last_offer_id: lastOfferId });
}

export async function deleteDiscordChannel(id: number): Promise<void> {
  try {
    await getDb().deleteFrom("discord_channels").where("id", "=", id).execute();
  } catch (error) {
    handleError("delete discord channel", error);
  }
}

export async function getChannelsNeedingOffers(): Promise<DiscordChannel[]> {
  try {
    // Get all channels that have offers newer than their last_offer_id
    return await getDb()
      .selectFrom("discord_channels")
      .selectAll()
      .where((qb) =>
        qb(
          "last_offer_id",
          "<",
          qb
            .selectFrom("offers")
            .select((selectQb) => selectQb.fn.max("id").as("max_id"))
            .where((innerQb) =>
              innerQb.and([
                innerQb(
                  "offers.source",
                  "=",
                  innerQb.ref("discord_channels.source"),
                ),
                innerQb(
                  "offers.type",
                  "=",
                  innerQb.ref("discord_channels.type"),
                ),
                innerQb(
                  "offers.duration",
                  "=",
                  innerQb.ref("discord_channels.duration"),
                ),
                innerQb(
                  "offers.platform",
                  "=",
                  innerQb.ref("discord_channels.platform"),
                ),
              ]),
            ),
        ),
      )
      .execute();
  } catch (error) {
    handleError("get channels needing offers", error);
  }
}

import type { Guild, NewsChannel, TextChannel } from "discord.js";

import { ChannelType, PermissionFlagsBits } from "discord.js";

type TextBasedFeedChannel = TextChannel | NewsChannel;

import type { FeedCombination } from "@/services/scraper/utils";
import type { Config } from "@/types/config";

import { OfferDuration, OfferPlatform, OfferType } from "@/types/basic";
import { logger } from "@/utils/logger";

/**
 * Generates a Discord-compatible channel name from a feed combination.
 * Uses simplified naming: only includes non-default values.
 * Defaults: type=GAME, duration=CLAIMABLE, platform=PC
 * Examples: "steam", "steam-loot", "epic-android", "gog-always"
 * @param combination - The feed combination to generate a name for.
 * @param prefix - Optional prefix to prepend to the channel name.
 * @returns The generated channel name.
 */
export function getFeedChannelName(combination: FeedCombination, prefix = ""): string {
  const parts: string[] = [combination.source.toLowerCase()];

  // Only add type if not GAME (the default)
  if (combination.type !== OfferType.GAME) {
    parts.push(combination.type.toLowerCase());
  }

  // Only add duration if not CLAIMABLE (the default)
  if (combination.duration !== OfferDuration.CLAIMABLE) {
    parts.push(combination.duration.toLowerCase());
  }

  // Only add platform if not PC (the default)
  if (combination.platform !== OfferPlatform.PC) {
    parts.push(combination.platform.toLowerCase());
  }

  const name = parts.join("-");
  const fullName = prefix ? `${prefix}${name}` : name;

  // Discord channel names: lowercase, no spaces, max 100 chars
  return fullName.slice(0, 100);
}

/**
 * Finds or creates a category channel for organizing feed channels.
 * @param guild - The Discord guild to create the category in.
 * @param categoryName - The name for the category channel.
 * @returns The ID of the category channel.
 */
export async function ensureCategoryChannel(guild: Guild, categoryName: string): Promise<string> {
  // Look for existing category
  const existingCategory = guild.channels.cache.find(
    (ch) => ch.type === ChannelType.GuildCategory && ch.name === categoryName,
  );

  if (existingCategory) {
    return existingCategory.id;
  }

  // Create new category
  logger.info(`Creating Discord category channel: ${categoryName}`);
  const newCategory = await guild.channels.create({
    name: categoryName,
    type: ChannelType.GuildCategory,
    reason: "LootScraper feed category",
  });

  return newCategory.id;
}

/**
 * Finds or creates a text channel for a specific feed combination.
 * @param guild - The Discord guild to create the channel in.
 * @param combination - The feed combination to create a channel for.
 * @param config - The application configuration.
 * @returns The text channel for the feed combination.
 */
export async function ensureFeedChannel(
  guild: Guild,
  combination: FeedCombination,
  config: Config,
): Promise<TextBasedFeedChannel> {
  const channelName = getFeedChannelName(combination, config.discord.channelPrefix);

  // Look for existing channel with matching name (text or announcement channel)
  const existingChannel = guild.channels.cache.find(
    (ch) =>
      (ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildAnnouncement) &&
      ch.name === channelName,
  ) as TextBasedFeedChannel | undefined;

  if (existingChannel) {
    return existingChannel;
  }

  // Ensure category exists
  const categoryId = await ensureCategoryChannel(guild, config.discord.categoryName);

  // Create new channel
  logger.info(`Creating Discord feed channel: ${channelName}`);
  const newChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: categoryId,
    reason: `LootScraper feed channel for ${combination.source} ${combination.type}`,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.SendMessages], // Users can't send messages
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
      },
      {
        id: guild.client.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks,
        ],
      },
    ],
  });

  return newChannel;
}

/**
 * Gets an existing channel for a feed combination, or undefined if it doesn't exist.
 * @param guild - The Discord guild to search in.
 * @param combination - The feed combination to find a channel for.
 * @param prefix - Optional prefix used in the channel name.
 * @returns The text channel if found, undefined otherwise.
 */
export function getExistingFeedChannel(
  guild: Guild,
  combination: FeedCombination,
  prefix = "",
): TextBasedFeedChannel | undefined {
  const channelName = getFeedChannelName(combination, prefix);

  return guild.channels.cache.find(
    (ch) =>
      (ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildAnnouncement) &&
      ch.name === channelName,
  ) as TextBasedFeedChannel | undefined;
}

/**
 * Gets a channel by its Discord ID.
 * @param guild - The Discord guild to search in.
 * @param channelId - The Discord channel ID to find.
 * @returns The text channel if found, undefined otherwise.
 */
export function getChannelById(guild: Guild, channelId: string): TextBasedFeedChannel | undefined {
  const channel = guild.channels.cache.get(channelId);
  if (channel?.type === ChannelType.GuildText || channel?.type === ChannelType.GuildAnnouncement) {
    return channel as TextBasedFeedChannel;
  }
  return undefined;
}

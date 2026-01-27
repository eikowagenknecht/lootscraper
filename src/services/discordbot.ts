import type { Guild, TextChannel } from "discord.js";

import { Client, Events, GatewayIntentBits, REST, Routes } from "discord.js";
import { DateTime } from "luxon";

import type { Config } from "@/types/config";
import type { DiscordChannel } from "@/types/database";

import {
  getAllDiscordChannels,
  getOrCreateDiscordChannel,
  updateDiscordChannelLastOfferId,
} from "@/services/database/discordChannelRepository";
import { getActiveOffers } from "@/services/database/offerRepository";
import { getEnabledFeedCombinations } from "@/services/scraper/utils";
import { logger } from "@/utils/logger";

import { getCommands, handleInteraction } from "./discordbot/handlers/commands";
import { ensureFeedChannel, getChannelById } from "./discordbot/utils/channels";
import { formatOfferEmbed } from "./discordbot/utils/formatters";

export interface DiscordConfig {
  botToken: string;
  guildId: string;
  adminRoleId: string;
  channelPrefix: string;
  categoryName: string;
}

export class DiscordBotService {
  private static instance: DiscordBotService | null = null;
  private client: Client | null = null;
  private discordConfig: DiscordConfig | null = null;
  private config: Config | null = null;
  private executor: NodeJS.Timeout | null = null;
  private postingOffers = false;

  private constructor() {
    // Private constructor to prevent instantiation
  }

  public static getInstance(): DiscordBotService {
    DiscordBotService.instance ??= new DiscordBotService();
    return DiscordBotService.instance;
  }

  public async initialize(config: Config): Promise<void> {
    this.config = config;
    this.discordConfig = {
      botToken: config.discord.botToken,
      guildId: config.discord.guildId,
      adminRoleId: config.discord.adminRoleId,
      channelPrefix: config.discord.channelPrefix,
      categoryName: config.discord.categoryName,
    };

    this.client = new Client({
      intents: [GatewayIntentBits.Guilds],
    });

    // Register event handlers
    this.client.once(Events.ClientReady, (readyClient) => {
      logger.info(`Discord bot ready. Logged in as ${readyClient.user.tag}`);
      void this.onReady();
    });

    this.client.on(Events.InteractionCreate, (interaction) => {
      if (!this.discordConfig) {
        return;
      }
      void handleInteraction(interaction, this.discordConfig);
    });

    this.client.on(Events.Error, (error) => {
      logger.error(`Discord client error: ${error.message}`);
    });

    // Register slash commands
    await this.registerCommands();
  }

  private async registerCommands(): Promise<void> {
    if (!this.discordConfig) {
      throw new Error("Discord config not initialized");
    }

    const rest = new REST().setToken(this.discordConfig.botToken);
    const commands = getCommands();

    try {
      logger.info("Registering Discord slash commands...");

      // Get application info to get the bot's application ID
      const appInfo = (await rest.get(Routes.currentApplication())) as {
        id: string;
      };

      await rest.put(Routes.applicationGuildCommands(appInfo.id, this.discordConfig.guildId), {
        body: commands,
      });

      logger.info("Discord slash commands registered successfully");
    } catch (error) {
      logger.error(
        `Failed to register Discord commands: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  public start(): void {
    if (!this.client || !this.discordConfig) {
      throw new Error("Discord bot not initialized. Call initialize() first.");
    }

    void this.client.login(this.discordConfig.botToken);
  }

  private async onReady(): Promise<void> {
    if (!this.config || !this.discordConfig) {
      return;
    }

    // Ensure feed channels exist
    await this.ensureFeedChannels();

    // Start periodic offer check
    this.startOfferCheck();
  }

  private async ensureFeedChannels(): Promise<void> {
    if (!this.client || !this.config || !this.discordConfig) {
      return;
    }

    const guild = this.client.guilds.cache.get(this.discordConfig.guildId);
    if (!guild) {
      logger.error(`Discord guild ${this.discordConfig.guildId} not found`);
      return;
    }

    const combinations = getEnabledFeedCombinations();

    for (const combination of combinations) {
      try {
        const channel = await ensureFeedChannel(guild, combination, this.config);

        // Register the channel in the database
        await getOrCreateDiscordChannel(
          channel.id,
          combination.source,
          combination.type,
          combination.duration,
          combination.platform,
        );
      } catch (error) {
        logger.error(
          `Failed to ensure feed channel for ${combination.source} ${combination.type}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  public async stop(): Promise<void> {
    // Stop periodic checks
    if (this.executor) {
      clearInterval(this.executor);
      this.executor = null;
    }

    if (this.client) {
      try {
        await this.client.destroy();
      } catch (error) {
        logger.error(
          `Error stopping Discord bot: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  public getClient(): Client {
    if (!this.client) {
      throw new Error("Discord bot not initialized. Call initialize() first.");
    }
    return this.client;
  }

  public getGuild(): Guild | undefined {
    if (!this.client || !this.discordConfig) {
      return undefined;
    }
    return this.client.guilds.cache.get(this.discordConfig.guildId);
  }

  private startOfferCheck(): void {
    const checkNewOffers = async () => {
      if (this.postingOffers) {
        logger.verbose("Discord service is busy posting offers.");
        return;
      }
      this.postingOffers = true;
      try {
        logger.debug("Checking for new Discord offers to post.");
        await this.postNewOffers();
        this.postingOffers = false;
      } catch (error) {
        logger.error(
          `Error in Discord offer check: ${error instanceof Error ? error.message : String(error)}`,
        );
        this.postingOffers = false;
      }
    };

    // Run immediately
    logger.verbose("Running Discord offer check immediately.");
    void checkNewOffers();

    logger.verbose("Scheduling Discord offer check to run every 60s.");
    this.executor = setInterval(() => void checkNewOffers(), 60_000);
  }

  private async postNewOffers(): Promise<void> {
    if (!this.client?.isReady() || !this.discordConfig) {
      return;
    }

    const guild = this.getGuild();
    if (!guild) {
      logger.error("Discord guild not available for posting offers");
      return;
    }

    try {
      const channels = await getAllDiscordChannels();

      for (const channelConfig of channels) {
        const channel = getChannelById(guild, channelConfig.channel_id);
        if (!channel) {
          logger.warn(`Discord channel ${channelConfig.channel_id} not found, skipping`);
          continue;
        }

        await this.sendNewOffersToChannel(channel, channelConfig);
      }
    } catch (error) {
      logger.error(
        `Failed to post offers to Discord: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async sendNewOffersToChannel(
    channel: TextChannel,
    channelConfig: DiscordChannel,
  ): Promise<void> {
    const offers = await getActiveOffers(DateTime.now(), {
      source: channelConfig.source,
      type: channelConfig.type,
      duration: channelConfig.duration,
      platform: channelConfig.platform,
      lastOfferId: channelConfig.last_offer_id,
    });

    let latestOfferId = channelConfig.last_offer_id;

    for (const offer of offers) {
      try {
        const { embed, components } = await formatOfferEmbed(offer);

        await channel.send({
          embeds: [embed],
          components,
        });

        latestOfferId = Math.max(latestOfferId, offer.id);

        logger.verbose(`Sent offer ${offer.id.toFixed(0)} to Discord channel ${channel.name}`);
      } catch (error) {
        logger.error(
          `Failed to send offer ${offer.id.toFixed(0)} to Discord: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    // Update last offer ID
    if (latestOfferId > channelConfig.last_offer_id) {
      await updateDiscordChannelLastOfferId(channelConfig.id, latestOfferId);
    }
  }

  /**
   * Populate all channels with all currently active offers.
   * This ignores last_offer_id and sends ALL active offers to each channel.
   * Useful for backfilling channels when the bot is first set up.
   * @returns The number of offers sent and channels populated.
   * @throws {Error} If the Discord bot is not ready or guild is not available.
   */
  public async populateChannels(): Promise<{ sent: number; channels: number }> {
    if (!this.client?.isReady() || !this.discordConfig) {
      throw new Error("Discord bot not ready");
    }

    const guild = this.getGuild();
    if (!guild) {
      throw new Error("Discord guild not available");
    }

    const channels = await getAllDiscordChannels();
    let totalSent = 0;
    let channelsPopulated = 0;

    for (const channelConfig of channels) {
      const channel = getChannelById(guild, channelConfig.channel_id);
      if (!channel) {
        logger.warn(`Discord channel ${channelConfig.channel_id} not found, skipping`);
        continue;
      }

      // Get ALL active offers for this channel's combination (no lastOfferId filter)
      const offers = await getActiveOffers(DateTime.now(), {
        source: channelConfig.source,
        type: channelConfig.type,
        duration: channelConfig.duration,
        platform: channelConfig.platform,
        // Note: intentionally not passing lastOfferId to get ALL active offers
      });

      if (offers.length === 0) {
        continue;
      }

      let latestOfferId = channelConfig.last_offer_id;
      let channelSent = 0;

      for (const offer of offers) {
        try {
          const { embed, components } = await formatOfferEmbed(offer);

          await channel.send({
            embeds: [embed],
            components,
          });

          latestOfferId = Math.max(latestOfferId, offer.id);
          channelSent++;
          totalSent++;

          logger.verbose(
            `Populated offer ${offer.id.toFixed(0)} to Discord channel ${channel.name}`,
          );
        } catch (error) {
          logger.error(
            `Failed to populate offer ${offer.id.toFixed(0)} to Discord: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }

      // Update last offer ID to prevent duplicates when posting future offers
      if (latestOfferId > channelConfig.last_offer_id) {
        await updateDiscordChannelLastOfferId(channelConfig.id, latestOfferId);
      }

      if (channelSent > 0) {
        channelsPopulated++;
        logger.info(
          `Populated ${channelSent.toFixed(0)} offers to Discord channel ${channel.name}`,
        );
      }
    }

    return { sent: totalSent, channels: channelsPopulated };
  }
}

export const discordBotService = DiscordBotService.getInstance();

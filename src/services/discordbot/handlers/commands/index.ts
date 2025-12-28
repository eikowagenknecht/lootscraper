import {
  type ChatInputCommandInteraction,
  type Interaction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { DateTime } from "luxon";
import {
  countActiveOffers,
  countOffers,
} from "@/services/database/offerRepository";
import {
  getLastCompletedRun,
  getUpcomingRuns,
} from "@/services/database/scrapingRunRepository";
import { type DiscordConfig, discordBotService } from "@/services/discordbot";
import { getFeedChannelName } from "@/services/discordbot/utils/channels";
import { scraperService } from "@/services/scraper";
import { getEnabledFeedCombinations } from "@/services/scraper/utils";
import { logger } from "@/utils/logger";

// Command definitions
const scrapenowCommand = new SlashCommandBuilder()
  .setName("scrapenow")
  .setDescription("Trigger an immediate scrape (Admin only)")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const statusCommand = new SlashCommandBuilder()
  .setName("status")
  .setDescription("Show bot status and statistics");

const populateCommand = new SlashCommandBuilder()
  .setName("populate")
  .setDescription(
    "Populate all channels with current active offers (Admin only)",
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export function getCommands() {
  return [
    scrapenowCommand.toJSON(),
    statusCommand.toJSON(),
    populateCommand.toJSON(),
  ];
}

function isAdmin(
  interaction: ChatInputCommandInteraction,
  config: DiscordConfig,
): boolean {
  // Server owner is always admin
  if (interaction.guild?.ownerId === interaction.user.id) {
    return true;
  }

  // Check for admin role
  if (config.adminRoleId && interaction.member) {
    const roles = Array.isArray(interaction.member.roles)
      ? interaction.member.roles
      : Array.from(interaction.member.roles.cache.keys());
    return roles.includes(config.adminRoleId);
  }

  return false;
}

async function handleScrapenowCommand(
  interaction: ChatInputCommandInteraction,
  config: DiscordConfig,
): Promise<void> {
  if (!isAdmin(interaction, config)) {
    await interaction.reply({
      content: "You don't have permission to use this command.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    // Queue all enabled scrapers to run immediately
    await scraperService.queueEnabledScrapers(true);
    await interaction.editReply("Scrape queued! This may take a few minutes.");
  } catch (error) {
    await interaction.editReply(
      `Failed to start scrape: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function handleStatusCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const client = discordBotService.getClient();
  const combinations = getEnabledFeedCombinations();

  const uptime = client.uptime ? Math.floor(client.uptime / 1000 / 60) : 0;

  // Fetch stats from database
  const now = DateTime.now();
  const totalOffers = await countOffers();
  const activeOffers = await countActiveOffers(now);
  const lastRun = await getLastCompletedRun();
  const upcomingRuns = await getUpcomingRuns(5);

  let lastScrapeText = "Never";
  if (lastRun?.finished_date) {
    const finishedAt = DateTime.fromISO(lastRun.finished_date);
    const diff = now.diff(finishedAt, ["hours", "minutes"]);
    const hours = Math.floor(diff.hours);
    const minutes = Math.floor(diff.minutes);
    const timeAgo =
      hours > 0
        ? `${hours.toFixed()}h ${minutes.toFixed()}m ago`
        : `${minutes.toFixed()}m ago`;
    lastScrapeText = `${lastRun.scraper} (${timeAgo})`;
  }

  // Format channel list
  const channelList =
    combinations.length > 0
      ? combinations.map((c) => `• #${getFeedChannelName(c)}`).join("\n")
      : "None";

  // Format upcoming runs
  let upcomingText = "None scheduled";
  if (upcomingRuns.length > 0) {
    upcomingText = upcomingRuns
      .map((run) => {
        const scheduledAt = DateTime.fromISO(run.scheduled_date);
        const diff = scheduledAt.diff(now, ["hours", "minutes"]);
        const hours = Math.floor(diff.hours);
        const minutes = Math.floor(diff.minutes);
        const timeText =
          diff.as("minutes") <= 0
            ? "now"
            : hours > 0
              ? `in ${hours.toFixed()}h ${minutes.toFixed()}m`
              : `in ${minutes.toFixed()}m`;
        return `• ${run.scraper} (${timeText})`;
      })
      .join("\n");
  }

  const latencyText =
    client.ws.ping > 0 ? `\n**Latency:** ${client.ws.ping.toFixed()}ms` : "";

  const statusText = `
**LootScraper Bot Status**

**Active Offers:** ${activeOffers.toFixed()}
**Total Offers Tracked:** ${totalOffers.toFixed()}
**Last Scrape:** ${lastScrapeText}
**Bot Uptime:** ${uptime.toFixed()} minutes${latencyText}

**Feed Channels:**
${channelList}

**Upcoming Scrapes:**
${upcomingText}
  `.trim();

  await interaction.reply({ content: statusText, ephemeral: true });
}

async function handlePopulateCommand(
  interaction: ChatInputCommandInteraction,
  config: DiscordConfig,
): Promise<void> {
  if (!isAdmin(interaction, config)) {
    await interaction.reply({
      content: "You don't have permission to use this command.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const result = await discordBotService.populateChannels();
    await interaction.editReply(
      `Populated channels with ${result.sent.toFixed()} offers across ${result.channels.toFixed()} channels.`,
    );
  } catch (error) {
    await interaction.editReply(
      `Failed to populate channels: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function handleInteraction(
  interaction: Interaction,
  config: DiscordConfig,
): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  try {
    switch (commandName) {
      case "scrapenow":
        await handleScrapenowCommand(interaction, config);
        break;
      case "status":
        await handleStatusCommand(interaction);
        break;
      case "populate":
        await handlePopulateCommand(interaction, config);
        break;
      default:
        await interaction.reply({
          content: "Unknown command",
          ephemeral: true,
        });
    }
  } catch (error) {
    logger.error(
      `Error handling Discord command ${commandName}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );

    const reply = {
      content: "An error occurred while processing your command.",
      ephemeral: true,
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(reply);
    } else {
      await interaction.reply(reply);
    }
  }
}

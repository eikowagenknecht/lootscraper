import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { DateTime, type Duration } from "luxon";
import { getGameWithInfo } from "@/services/database/gameRepository";
import { translationService } from "@/services/translation";
import { OfferDuration, OfferSource } from "@/types/basic";
import type { Offer } from "@/types/database";

const SOURCE_COLORS: Record<OfferSource, number> = {
  [OfferSource.STEAM]: 0x1b2838, // Steam dark blue
  [OfferSource.EPIC]: 0x2f2f2f, // Epic dark gray
  [OfferSource.GOG]: 0x86328a, // GOG purple
  [OfferSource.AMAZON]: 0xff9900, // Amazon orange
  [OfferSource.HUMBLE]: 0xcc2929, // Humble red
  [OfferSource.ITCH]: 0xfa5c5c, // itch.io red/pink
  [OfferSource.UBISOFT]: 0x0070ff, // Ubisoft blue
  [OfferSource.APPLE]: 0x555555, // Apple gray
  [OfferSource.GOOGLE]: 0x4285f4, // Google blue
};

export function getSourceColor(source: OfferSource): number {
  return SOURCE_COLORS[source];
}

export interface OfferEmbedResult {
  embed: EmbedBuilder;
  components: ActionRowBuilder<ButtonBuilder>[];
}

export async function formatOfferEmbed(
  offer: Offer,
): Promise<OfferEmbedResult> {
  const game = offer.game_id ? await getGameWithInfo(offer.game_id) : null;

  const embed = new EmbedBuilder()
    .setColor(getSourceColor(offer.source))
    .setTitle(offer.title)
    .setFooter({
      text: `ID: ${offer.id.toFixed()} | ${translationService.getSourceDisplay(offer.source)}`,
    })
    .setTimestamp(DateTime.fromISO(offer.seen_first).toJSDate());

  // Add offer type info
  const additionalInfo =
    offer.duration !== OfferDuration.CLAIMABLE
      ? `${translationService.getTypeDisplay(offer.type)} | ${translationService.getPlatformDisplay(offer.platform)} | ${translationService.getDurationDisplay(offer.duration)}`
      : `${translationService.getTypeDisplay(offer.type)} | ${translationService.getPlatformDisplay(offer.platform)}`;

  embed.setDescription(additionalInfo);

  // Add thumbnail image
  const imageUrl = offer.img_url ?? game?.steamInfo?.image_url;
  if (imageUrl) {
    embed.setThumbnail(imageUrl);
  }

  // Add expiration info
  if (offer.valid_to) {
    const validTo = DateTime.fromISO(offer.valid_to);
    const now = DateTime.now();
    let diff: Duration;
    let expiryText: string;

    if (now < validTo) {
      diff = validTo.diff(now, ["days", "hours"]);
      const diffHuman = diff.normalize().toHuman({ maximumFractionDigits: 0 });
      expiryText = `Expires in ${diffHuman}`;
    } else {
      diff = now.diff(validTo, ["days", "hours"]);
      const diffHuman = diff.normalize().toHuman({ maximumFractionDigits: 0 });
      expiryText = `Expired ${diffHuman} ago`;
    }

    embed.addFields({
      name: "Validity",
      value: `${expiryText}\n${validTo.toFormat("yyyy-MM-dd HH:mm")} UTC`,
      inline: true,
    });
  } else if (offer.duration === OfferDuration.ALWAYS) {
    embed.addFields({
      name: "Validity",
      value: "Always free - no need to hurry!",
      inline: true,
    });
  } else {
    embed.addFields({
      name: "Validity",
      value: "No known end date",
      inline: true,
    });
  }

  // Add game info if available
  if (game) {
    const ratings: string[] = [];

    if (game.steamInfo?.metacritic_score) {
      ratings.push(`Metacritic: ${game.steamInfo.metacritic_score.toFixed()}%`);
    }

    if (game.steamInfo?.percent && game.steamInfo.recommendations) {
      ratings.push(
        `Steam: ${game.steamInfo.percent.toFixed()}% (${game.steamInfo.recommendations.toFixed()} reviews)`,
      );
    }

    if (game.igdbInfo?.meta_score && game.igdbInfo.meta_ratings) {
      ratings.push(
        `IGDB Meta: ${game.igdbInfo.meta_score.toFixed()}% (${game.igdbInfo.meta_ratings.toFixed()} sources)`,
      );
    }

    if (game.igdbInfo?.user_score && game.igdbInfo.user_ratings) {
      ratings.push(
        `IGDB User: ${game.igdbInfo.user_score.toFixed()}% (${game.igdbInfo.user_ratings.toFixed()} ratings)`,
      );
    }

    if (ratings.length > 0) {
      embed.addFields({
        name: "Ratings",
        value: ratings.join("\n"),
        inline: true,
      });
    }

    // Release date
    const releaseDate =
      game.igdbInfo?.release_date ?? game.steamInfo?.release_date;
    if (releaseDate) {
      embed.addFields({
        name: "Release Date",
        value: DateTime.fromISO(releaseDate).toFormat("yyyy-MM-dd"),
        inline: true,
      });
    }

    // Price
    if (game.steamInfo?.recommended_price_eur) {
      embed.addFields({
        name: "Original Price",
        value: `${game.steamInfo.recommended_price_eur.toFixed(2)} EUR`,
        inline: true,
      });
    }

    // Genres
    if (game.steamInfo?.genres) {
      embed.addFields({
        name: "Genres",
        value: game.steamInfo.genres,
        inline: true,
      });
    }

    // Description
    const description =
      game.igdbInfo?.short_description ?? game.steamInfo?.short_description;
    if (description) {
      // Truncate if too long (Discord field limit is 1024)
      const truncatedDesc =
        description.length > 500
          ? `${description.slice(0, 497)}...`
          : description;
      embed.addFields({
        name: "Description",
        value: truncatedDesc,
        inline: false,
      });
    }
  }

  // Create buttons
  const components: ActionRowBuilder<ButtonBuilder>[] = [];

  if (offer.url) {
    const claimButton = new ButtonBuilder()
      .setLabel("Claim Now")
      .setStyle(ButtonStyle.Link)
      .setURL(offer.url)
      .setEmoji("🎮");

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      claimButton,
    );

    // Add more info links if available
    if (game?.steamInfo?.url) {
      row.addComponents(
        new ButtonBuilder()
          .setLabel("Steam")
          .setStyle(ButtonStyle.Link)
          .setURL(game.steamInfo.url),
      );
    }

    if (game?.steamInfo?.metacritic_url) {
      row.addComponents(
        new ButtonBuilder()
          .setLabel("Metacritic")
          .setStyle(ButtonStyle.Link)
          .setURL(game.steamInfo.metacritic_url),
      );
    }

    if (game?.igdbInfo?.url) {
      row.addComponents(
        new ButtonBuilder()
          .setLabel("IGDB")
          .setStyle(ButtonStyle.Link)
          .setURL(game.igdbInfo.url),
      );
    }

    components.push(row);
  }

  return { embed, components };
}

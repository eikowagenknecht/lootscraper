import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ScraperCombination } from "@/scrapers/utils";
import { getGameWithInfo } from "@/services/database/gameRepository";
import { translationService } from "@/services/translation";
import { OfferDuration } from "@/types/basic";
import type { Config } from "@/types/config";
import type { Game, IgdbInfo, Offer, SteamInfo } from "@/types/database";
import { FeedError } from "@/types/errors";
import { AtomFeed } from "@/utils/atom";
import { logger } from "@/utils/logger";
import { generateFeedTitle, generateFilename } from "@/utils/names";
import { getDataPath } from "@/utils/path";
import { DateTime } from "luxon";

export class RssGenerator {
  private readonly feedGenerator: AtomFeed;

  constructor(
    private readonly config: Config,
    private readonly combination?: ScraperCombination,
  ) {
    this.feedGenerator = new AtomFeed({
      id: this.config.feed.idPrefix + this.getFeedId(),
      title: generateFeedTitle(this.combination),
      generator: {
        content: "LootScraper",
        uri: "https://github.com/eikowagenknecht/lootscraper",
      },
      language: "en",
      link: [
        {
          href: config.feed.urlAlternate,
          rel: "alternate",
        },
        {
          href: `${config.feed.urlPrefix}${this.getFilename()}`,
          rel: "self",
        },
      ],
      author: [
        {
          name: config.feed.authorName,
          email: config.feed.authorEmail,
          uri: config.feed.authorWeb,
        },
      ],
    });
  }

  public async generateFeed(offers: Offer[]): Promise<void> {
    logger.info(`Generating RSS feed for ${offers.length.toFixed()} offers...`);

    for (const offer of offers) {
      const updated =
        offer.valid_from && offer.valid_from > offer.seen_first
          ? DateTime.fromISO(offer.valid_from).toJSDate()
          : DateTime.fromISO(offer.seen_first).toJSDate();

      let gameInfo: {
        game: Game;
        steamInfo: SteamInfo | null;
        igdbInfo: IgdbInfo | null;
      } | null = null;
      if (offer.game_id) {
        gameInfo = await getGameWithInfo(offer.game_id);
      }

      this.feedGenerator.addEntry({
        id: `${this.config.feed.idPrefix}${offer.id.toFixed()}`,
        title: this.getEntryTitle(offer),
        ...(offer.url && { link: [{ href: offer.url }] }),
        updated: updated,
        published: DateTime.fromISO(offer.seen_first).toJSDate(),
        content: {
          type: "xhtml",
          content: this.generateContent(offer, gameInfo),
        },
        author: [
          {
            name: this.config.feed.authorName,
            email: this.config.feed.authorEmail,
            uri: this.config.feed.authorWeb,
          },
        ],
        category: gameInfo?.steamInfo?.genres
          ? gameInfo.steamInfo.genres.split(",").map((genre) => ({
              term: `Genre: ${genre.trim()}`,
              scheme: "https://store.steampowered.com/category/",
              label: genre.trim(),
            }))
          : [],
      });
    }

    try {
      const outputPath = resolve(getDataPath(), this.getFilename());
      await writeFile(outputPath, this.feedGenerator.toXML());
    } catch (error) {
      throw new FeedError(
        `Failed to write feed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private getFilename(): string {
    return generateFilename({
      prefix: this.config.common.feedFilePrefix,
      extension: "xml",
      ...(this.combination && {
        source: this.combination.source,
        type: this.combination.type,
        duration: this.combination.duration,
      }),
    });
  }

  private getFeedId(): string {
    const filename = this.getFilename();
    const parts = filename.split("_", 2);
    const feedId = parts.length === 1 ? "" : parts[1].replace(".xml", "");
    return feedId;
  }

  private getEntryTitle(offer: Offer): string {
    const additionalInfo: string[] = [
      translationService.getTypeDisplay(offer.type),
    ];
    if (offer.duration !== OfferDuration.CLAIMABLE) {
      additionalInfo.push(
        translationService.getDurationDisplay(offer.duration),
      );
    }
    return `${translationService.getSourceDisplay(offer.source)} (${additionalInfo.join(", ")}) - ${offer.title}`;
  }

  private generateContent(
    offer: Offer,
    gameInfo: {
      game: Game;
      steamInfo: SteamInfo | null;
      igdbInfo: IgdbInfo | null;
    } | null,
  ): string {
    let content = "";

    // Add image
    if (offer.img_url) {
      content += `<img src="${this.escapeHtml(offer.img_url)}" />`;
    } else if (gameInfo?.steamInfo?.image_url) {
      content += `<img src="${this.escapeHtml(gameInfo.steamInfo.image_url)}" />`;
    }

    content += "<ul>";

    // Dates
    const validFrom = offer.valid_from
      ? DateTime.fromISO(offer.valid_from).toFormat("yyyy-MM-dd HH:mm")
      : DateTime.fromISO(offer.seen_first).toFormat("yyyy-MM-dd HH:mm");

    content += `<li><b>Offer valid from:</b> ${validFrom}</li>`;

    if (offer.valid_to) {
      const validTo = DateTime.fromISO(offer.valid_to).toFormat(
        "yyyy-MM-dd HH:mm",
      );
      content += `<li><b>Offer valid to:</b> ${validTo}</li>`;
    }

    // Game info
    if (gameInfo) {
      content += this.generateGameInfoContent(gameInfo);
    }

    content += "</ul>";

    // Add claim link
    if (offer.url) {
      content += `<p>Claim it now for free on <a href="${this.escapeHtml(offer.url)}">${translationService.getSourceDisplay(offer.source)}</a>.</p>`;
    }

    // Add footer
    content += `<p><small>Source: ${translationService.getSourceDisplay(offer.source)}, Seen first: ${DateTime.fromISO(
      offer.seen_first,
    ).toFormat(
      "yyyy-MM-dd HH:mm:ss",
    )}, Generated by <a href="https://github.com/eikowagenknecht/lootscraper">LootScraper</a></small></p>`;

    return content;
  }

  private generateGameInfoContent(gameInfo: {
    game: Game;
    steamInfo: SteamInfo | null;
    igdbInfo: IgdbInfo | null;
  }): string {
    let content = "<p>About the game";

    if (gameInfo.igdbInfo?.name) {
      content += ` (<b>${this.escapeHtml(gameInfo.igdbInfo.name)}</b>*)`;
    } else if (gameInfo.steamInfo?.name) {
      content += ` (<b>${this.escapeHtml(gameInfo.steamInfo.name)}</b>*)`;
    }
    content += ":</p><ul>";

    // Ratings
    const ratings: string[] = [];
    if (gameInfo.steamInfo?.metacritic_score) {
      let text = `Metacritic ${gameInfo.steamInfo.metacritic_score.toFixed()}%`;
      if (gameInfo.steamInfo.metacritic_url) {
        text = `<a href="${this.escapeHtml(gameInfo.steamInfo.metacritic_url)}">${text}</a>`;
      }
      ratings.push(text);
    }

    if (
      gameInfo.steamInfo?.percent &&
      gameInfo.steamInfo.score &&
      gameInfo.steamInfo.recommendations
    ) {
      let text = `Steam ${gameInfo.steamInfo.percent.toFixed()}% (${gameInfo.steamInfo.score.toFixed()}/10, ${gameInfo.steamInfo.recommendations.toFixed(
        0,
      )} recommendations)`;
      text = `<a href="${this.escapeHtml(gameInfo.steamInfo.url)}">${text}</a>`;
      ratings.push(text);
    }

    if (gameInfo.igdbInfo?.meta_ratings && gameInfo.igdbInfo.meta_score) {
      let text = `IGDB Meta ${gameInfo.igdbInfo.meta_score.toFixed()}% (${gameInfo.igdbInfo.meta_ratings.toFixed(
        0,
      )} sources)`;
      if (gameInfo.igdbInfo.url) {
        text = `<a href="${this.escapeHtml(gameInfo.igdbInfo.url)}">${text}</a>`;
      }
      ratings.push(text);
    }

    if (gameInfo.igdbInfo?.user_ratings && gameInfo.igdbInfo.user_score) {
      let text = `IGDB User ${gameInfo.igdbInfo.user_score.toFixed()}% (${gameInfo.igdbInfo.user_ratings.toFixed(
        0,
      )} sources)`;
      if (gameInfo.igdbInfo.url) {
        text = `<a href="${this.escapeHtml(gameInfo.igdbInfo.url)}">${text}</a>`;
      }
      ratings.push(text);
    }

    if (ratings.length > 0) {
      content += `<li><b>Ratings:</b> ${ratings.join(" / ")}</li>`;
    }

    // Release date
    const releaseDate =
      gameInfo.igdbInfo?.release_date ?? gameInfo.steamInfo?.release_date;
    if (releaseDate) {
      content += `<li><b>Release date:</b> ${DateTime.fromISO(
        releaseDate,
      ).toFormat("yyyy-MM-dd")}</li>`;
    }

    // Price
    const price = gameInfo.steamInfo?.recommended_price_eur;
    if (price) {
      content += `<li><b>Recommended price (Steam):</b> ${price.toFixed(
        2,
      )} EUR</li>`;
    }

    // Description
    const description =
      gameInfo.igdbInfo?.short_description ??
      gameInfo.steamInfo?.short_description;
    if (description) {
      content += `<li><b>Description:</b> ${this.escapeHtml(description)}</li>`;
    }

    // Genres
    if (gameInfo.steamInfo?.genres) {
      content += `<li><b>Genres:</b> ${this.escapeHtml(gameInfo.steamInfo.genres)}</li>`;
    }

    content += "</ul>";
    content +=
      "<p>* Any information about the offer is automatically grabbed and may in rare cases not match the correct game.</p>";

    return content;
  }

  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

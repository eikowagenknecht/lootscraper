import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Config } from "@/types/config";
import { OfferDuration, type OfferSource, OfferType } from "@/types/config";
import type { Game, IgdbInfo, Offer, SteamInfo } from "@/types/database";
import { FeedError } from "@/types/errors";
import { Feed } from "feed";
import type { Feed as FeedType } from "feed";
import { DateTime } from "luxon";
import { getGameWithInfo } from "../database/gameRepository";

interface FeedGeneratorOptions {
  source?: OfferSource;
  type?: OfferType;
  duration?: OfferDuration;
}

export class RssGenerator {
  private readonly feedGenerator: FeedType;

  constructor(
    private readonly config: Config,
    private readonly options: FeedGeneratorOptions = {},
  ) {
    this.feedGenerator = new Feed({
      id: this.getFeedId(),
      title: this.getFeedTitle(),
      updated: new Date(),
      generator: "LootScraper",
      language: "en",
      copyright: "TODO",
      feed: `${config.feed.urlPrefix}${this.getFilename()}`,
      feedLinks: {
        atom: `${config.feed.urlPrefix}${this.getFilename()}`,
      },
      link: config.feed.urlAlternate,
      author: {
        name: config.feed.authorName,
        email: config.feed.authorEmail,
        link: config.feed.authorWeb,
      },
    });
  }

  public async generateFeed(offers: Offer[]): Promise<void> {
    if (offers.length === 0) return;

    for (const offer of offers) {
      // Skip entries without dates or future entries
      if (offer.valid_from && offer.valid_from > offer.seen_last) continue;

      const updated =
        offer.valid_from && offer.valid_from > offer.seen_first
          ? new Date(offer.valid_from)
          : new Date(offer.seen_first);

      let gameInfo: {
        game: Game;
        steamInfo: SteamInfo | null;
        igdbInfo: IgdbInfo | null;
      } | null = null;
      if (offer.game_id) {
        gameInfo = await getGameWithInfo(offer.game_id);
      }

      this.feedGenerator.addItem({
        id: `${this.config.feed.idPrefix}${offer.id.toFixed(0)}`,
        title: this.getEntryTitle(offer),
        link: offer.url ?? this.config.feed.urlAlternate,
        date: updated,
        published: DateTime.fromISO(offer.seen_first).toJSDate(),
        content: this.generateContent(offer, gameInfo),
        author: [
          {
            name: this.config.feed.authorName,
            email: this.config.feed.authorEmail,
            link: this.config.feed.authorWeb,
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
      const outputPath = resolve(process.cwd(), "data", this.getFilename());
      await writeFile(outputPath, this.feedGenerator.atom1());
    } catch (error) {
      throw new FeedError(
        `Failed to write feed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private getFilename(): string {
    const parts: string[] = [this.config.common.feedFilePrefix];

    if (this.options.source) parts.push(this.options.source);
    if (this.options.type) parts.push(this.options.type);
    if (this.options.duration) parts.push(this.options.duration);

    return `${parts.join("_")}.xml`;
  }

  private getFeedId(): string {
    const filename = this.getFilename();
    const parts = filename.split("_", 2);
    return parts.length === 1 ? "" : parts[1].replace(".xml", "");
  }

  private getFeedTitle(): string {
    if (!this.options.source && !this.options.type && !this.options.duration) {
      return "Free Games and Loot";
    }

    const parts = ["Free"];

    if (this.options.source) {
      parts.push(this.options.source);
    }

    if (this.options.type === OfferType.GAME) {
      parts.push("Games");
    } else if (this.options.type === OfferType.LOOT) {
      parts.push("Loot");
    }

    if (
      this.options.duration === OfferDuration.TEMPORARY ||
      this.options.duration === OfferDuration.ALWAYS
    ) {
      parts.push(`(${this.options.duration})`);
    }

    return parts.join(" ");
  }

  private getEntryTitle(offer: Offer): string {
    const additionalInfo: (OfferType | OfferDuration)[] = [offer.type];
    if (offer.duration !== OfferDuration.CLAIMABLE) {
      additionalInfo.push(offer.duration);
    }
    return `${offer.source} (${additionalInfo.join(", ")}) - ${offer.title}`;
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
      ? DateTime.fromJSDate(new Date(offer.valid_from)).toFormat(
          "yyyy-MM-dd HH:mm",
        )
      : DateTime.fromJSDate(new Date(offer.seen_first)).toFormat(
          "yyyy-MM-dd HH:mm",
        );

    content += `<li><b>Offer valid from:</b> ${validFrom}</li>`;

    if (offer.valid_to) {
      const validTo = DateTime.fromJSDate(new Date(offer.valid_to)).toFormat(
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
      content += `<p>Claim it now for free on <a href="${this.escapeHtml(offer.url)}">${this.escapeHtml(offer.source)}</a>.</p>`;
    }

    // Add footer
    content += `<p><small>Source: ${this.escapeHtml(offer.source)}, Seen first: ${DateTime.fromJSDate(
      new Date(offer.seen_first),
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
      let text = `Metacritic ${gameInfo.steamInfo.metacritic_score.toFixed(0)}%`;
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
      let text = `Steam ${gameInfo.steamInfo.percent.toFixed(0)}% (${gameInfo.steamInfo.score.toFixed(0)}/10, ${gameInfo.steamInfo.recommendations.toFixed(
        0,
      )} recommendations)`;
      text = `<a href="${this.escapeHtml(gameInfo.steamInfo.url)}">${text}</a>`;
      ratings.push(text);
    }

    if (gameInfo.igdbInfo?.meta_ratings && gameInfo.igdbInfo.meta_score) {
      let text = `IGDB Meta ${gameInfo.igdbInfo.meta_score.toFixed(0)}% (${gameInfo.igdbInfo.meta_ratings.toFixed(
        0,
      )} sources)`;
      if (gameInfo.igdbInfo.url) {
        text = `<a href="${this.escapeHtml(gameInfo.igdbInfo.url)}">${text}</a>`;
      }
      ratings.push(text);
    }

    if (gameInfo.igdbInfo?.user_ratings && gameInfo.igdbInfo.user_score) {
      let text = `IGDB User ${gameInfo.igdbInfo.user_score.toFixed(0)}% (${gameInfo.igdbInfo.user_ratings.toFixed(
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

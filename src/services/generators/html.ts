import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import Handlebars from "handlebars";
import { DateTime } from "luxon";
import { getGameWithInfo } from "@/services/database/gameRepository";
import type { FeedCombination } from "@/services/scraper/utils";
import { translationService } from "@/services/translation";
import type { Config } from "@/types/config";
import type { Offer } from "@/types/database";
import { getDataPath } from "@/utils/path";
import {
  cleanHtml,
  generateFeedTitle,
  generateFilename,
} from "@/utils/stringTools";

// The latest static URL for the Tailwind CSS stylesheet.
const CSS_URL =
  "https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css";
const TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{{feed.title}}</title>
    <link href="${CSS_URL}" rel="stylesheet">
</head>
<body class="bg-gray-100">
    <div class="container mx-auto p-8">
        <h1 class="text-4xl font-bold mb-4">{{feed.title}}</h1>

        {{#each entries}}
        <!-- Header & Validity -->
        <h2 class="flex justify-between items-center text-2xl mb-2 {{#if is_expired}}line-through{{/if}}">
            <span class="font-bold">{{{title}}}</span>
            <span class="text-sm">Valid from {{{valid_from}}}{{#if valid_to}} to {{{valid_to}}}{{/if}}</span>
        </h2>

        <div class="flex bg-white rounded-lg shadow-md p-6 mb-8">
            {{#if img_url}}
            <!-- Image -->
            <div>
                <img src="{{{img_url}}}" alt="{{{title}}}" class="w-96">
            </div>
            {{/if}}

            <!-- Content -->
            <div class="flex-1 ml-4">
                {{#if has_game}}
                <!-- Game Info -->
                <div class="bg-gray-200 p-4 rounded-lg text-sm">
                    <div class="flex justify-between mb-2">
                        <h3 class="font-bold underline">{{{game_name}}}</h3>
                        {{#if release_date}}
                        <span><strong>Release Date:</strong> {{{release_date}}}</span>
                        {{/if}}
                    </div>

                    <!-- Ratings -->
                    <div class="flex flex-wrap mb-2">
                        {{#if steam_percent}}
                        <span class="rounded-full px-3 py-1 text-sm font-semibold m-1
                            {{#if (gt steam_percent 90)}}bg-green-700
                            {{else if (gt steam_percent 80)}}bg-green-500
                            {{else if (gt steam_percent 60)}}bg-yellow-500
                            {{else}}bg-red-600{{/if}}">
                            <a href="{{{steam_url}}}">Steam: {{steam_percent}}% / {{steam_score}} ({{steam_recommendations}} recommendations)</a>
                        </span>
                        {{/if}}

                        {{#if igdb_meta_score}}
                        <span class="rounded-full px-3 py-1 text-sm font-semibold m-1
                            {{#if (gt igdb_meta_score 90)}}bg-green-700
                            {{else if (gt igdb_meta_score 80)}}bg-green-500
                            {{else if (gt igdb_meta_score 60)}}bg-yellow-500
                            {{else}}bg-red-600{{/if}}">
                            <a href="{{{igdb_url}}}">IGDB Meta: {{igdb_meta_score}}% ({{igdb_meta_ratings}} sources)</a>
                        </span>
                        {{/if}}

                        {{#if metacritic_score}}
                        <span class="rounded-full px-3 py-1 text-sm font-semibold m-1
                            {{#if (gt metacritic_score 90)}}bg-green-700
                            {{else if (gt metacritic_score 80)}}bg-green-500
                            {{else if (gt metacritic_score 60)}}bg-yellow-500
                            {{else}}bg-red-600{{/if}}">
                            {{#if metacritic_url}}<a href="{{{metacritic_url}}}">{{/if}}
                            Metacritic: {{metacritic_score}}%
                            {{#if metacritic_url}}</a>{{/if}}
                        </span>
                        {{/if}}

                        {{#if igdb_user_score}}
                        <span class="rounded-full px-3 py-1 text-sm font-semibold m-1
                            {{#if (gt igdb_user_score 90)}}bg-green-700
                            {{else if (gt igdb_user_score 80)}}bg-green-500
                            {{else if (gt igdb_user_score 60)}}bg-yellow-500
                            {{else}}bg-red-600{{/if}}">
                            <a href="{{{igdb_url}}}">IGDB User: {{igdb_user_score}}% ({{igdb_user_ratings}} sources)</a>
                        </span>
                        {{/if}}
                    </div>

                    {{#if genres}}
                    <!-- Genres -->
                    <div class="flex flex-wrap mb-2">
                        <div class="flex flex-wrap">
                            {{#each (split genres ", ")}}
                            <span class="text-white bg-gray-500 rounded-full px-3 py-1 text-sm font-semibold m-1">#{{{this}}}</span>
                            {{/each}}
                        </div>
                    </div>
                    {{/if}}

                    {{#if description}}
                    <!-- Description -->
                    <div>{{description}}</div>
                    {{/if}}
                </div>
                {{/if}}

                <div class="flex justify-between items-center mt-4">
                    {{#if url}}
                    <!-- Claim Button -->
                    <a href="{{{url}}}" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                        Claim on {{{source}}}
                    </a>
                    {{/if}}

                    {{#if recommended_price}}
                    <!-- Price -->
                    <span class="bg-gray-500 text-white font-bold py-2 px-4 rounded line-through">
                        {{recommended_price}} EUR
                    </span>
                    {{/if}}
                </div>
            </div>
        </div>
        {{/each}}
    </div>
</body>
</html>`;

interface HtmlGeneratorOptions {
  combination?: FeedCombination;
  withHistory?: boolean;
}

export class HtmlGenerator {
  private readonly template: HandlebarsTemplateDelegate;

  constructor(
    private readonly config: Config,
    private readonly options: HtmlGeneratorOptions = {},
  ) {
    this.registerHelpers();
    this.template = Handlebars.compile(TEMPLATE);
  }

  private registerHelpers(): void {
    Handlebars.registerHelper("gt", (a: number, b: number) => a > b);
    Handlebars.registerHelper("split", (str: string, separator: string) =>
      str.split(separator),
    );
  }

  public async generateHtml(offers: Offer[]): Promise<void> {
    const entries = [];
    for (const offer of offers) {
      const gameInfo = offer.game_id
        ? await getGameWithInfo(offer.game_id)
        : null;

      entries.push({
        id: `${this.config.feed.idPrefix}${offer.id.toFixed()}`,
        title: offer.title,
        img_url: offer.img_url ?? gameInfo?.steamInfo?.image_url,
        valid_from: offer.valid_from
          ? DateTime.fromISO(offer.valid_from).toFormat("yyyy-MM-dd")
          : DateTime.fromISO(offer.seen_first).toFormat("yyyy-MM-dd"),
        valid_to: offer.valid_to
          ? DateTime.fromISO(offer.valid_to).toFormat("yyyy-MM-dd")
          : undefined,
        source: translationService.getSourceDisplay(offer.source),
        url: offer.url,
        is_expired:
          offer.valid_to && DateTime.fromISO(offer.valid_to) < DateTime.now(),
        has_game: !!gameInfo,
        game_name: gameInfo?.igdbInfo?.name ?? gameInfo?.steamInfo?.name,
        metacritic_score: gameInfo?.steamInfo?.metacritic_score,
        metacritic_url: gameInfo?.steamInfo?.metacritic_url,
        steam_percent: gameInfo?.steamInfo?.percent,
        steam_score: gameInfo?.steamInfo?.score,
        steam_recommendations: gameInfo?.steamInfo?.recommendations,
        steam_url: gameInfo?.steamInfo?.url,
        igdb_meta_score: gameInfo?.igdbInfo?.meta_score,
        igdb_meta_ratings: gameInfo?.igdbInfo?.meta_ratings,
        igdb_url: gameInfo?.igdbInfo?.url,
        igdb_user_score: gameInfo?.igdbInfo?.user_score,
        igdb_user_ratings: gameInfo?.igdbInfo?.user_ratings,
        release_date: gameInfo?.igdbInfo?.release_date
          ? DateTime.fromISO(gameInfo.igdbInfo.release_date).toFormat(
              "yyyy-MM-dd",
            )
          : gameInfo?.steamInfo?.release_date
            ? DateTime.fromISO(gameInfo.steamInfo.release_date).toFormat(
                "yyyy-MM-dd",
              )
            : undefined,
        recommended_price: gameInfo?.steamInfo?.recommended_price_eur,
        description:
          gameInfo?.igdbInfo?.short_description ??
          gameInfo?.steamInfo?.short_description,
        genres: gameInfo?.steamInfo?.genres,
      });
    }

    const html = this.template({
      feed: {
        title: this.getFeedTitle(),
        author_name: this.config.feed.authorName,
        author_email: this.config.feed.authorEmail,
        author_web: this.config.feed.authorWeb,
      },

      // Sort time entries in descending order by valid_from date,
      // then valid_to date (if present), and finally in ascending order by title.

      entries: entries.sort((a, b) => {
        // First compare by valid_from
        const validFromComparison = b.valid_from.localeCompare(a.valid_from);

        if (validFromComparison !== 0) {
          return validFromComparison;
        }

        // If valid_from is the same, compare by valid_to (if it exists)
        if (a.valid_to && b.valid_to) {
          const validToComparison = b.valid_to.localeCompare(a.valid_to);

          if (validToComparison !== 0) {
            return validToComparison;
          }
        }

        // If valid_to is also the same, compare by title
        return a.title.localeCompare(b.title);
      }),
    });

    const cleanedHtml = cleanHtml(html);

    const outputPath = resolve(getDataPath(), this.getFilename());
    await writeFile(outputPath, cleanedHtml);
  }

  private getFilename(): string {
    return generateFilename({
      prefix: this.config.common.feedFilePrefix,
      extension: "html",
      ...(this.options.combination && {
        combination: this.options.combination,
      }),
      ...(this.options.withHistory && {
        withHistory: this.options.withHistory,
      }),
    });
  }

  private getFeedTitle(): string {
    return generateFeedTitle(this.options.combination);
  }
}

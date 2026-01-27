import { DateTime } from "luxon";
import { errors } from "playwright";

import type { NewSteamInfo } from "@/types/database";

import { browserService } from "@/services/browser";
import { getMatchScore } from "@/utils";
import { logger } from "@/utils/logger";

type SteamApiResponse = Record<
  string,
  {
    success: boolean;
    data?: {
      name: string;
      short_description?: string;
      header_image?: string;
      is_free?: boolean;
      price_overview?: {
        initial: number;
        currency: string;
      };
      release_date?: {
        date: string;
      };
      genres?: { description: string }[];
      recommendations?: {
        total: number;
      };
      metacritic?: {
        score: number;
        url: string;
      };
      screenshots?: { path_full: string }[];
      publishers?: string[];
    };
  }
>;

export class SteamClient {
  private static readonly STORE_URL = "https://store.steampowered.com";
  private static readonly API_URL = "https://store.steampowered.com/api/appdetails";
  private static readonly RESULT_MATCH_THRESHOLD = 0.75;

  public async findSteamId(searchString: string): Promise<number | null> {
    logger.debug(`Finding Steam ID for: ${searchString}`);

    const context = browserService.getContext();

    const searchUrl = new URL("https://store.steampowered.com/search/");
    searchUrl.searchParams.set("term", searchString);
    searchUrl.searchParams.set("category1", "998"); // Games category

    const page = await context.newPage();
    try {
      await page.goto(searchUrl.toString(), { timeout: 30_000 });

      const elements = await page
        .locator("#search_result_container a")
        .filter({ has: page.locator(".title") })
        .all();

      let bestMatch: { appId: number; score: number; title: string } | null = null;

      for (const element of elements) {
        const title = await element.locator(".title").textContent();
        const appId = await element.getAttribute("data-ds-appid");

        logger.debug(`Found title (Steam Id): ${String(title)} (${String(appId)})`);

        if (!title || !appId) {
          continue;
        }

        const score = getMatchScore(searchString, title);
        if (
          score >= SteamClient.RESULT_MATCH_THRESHOLD &&
          (!bestMatch || score > bestMatch.score)
        ) {
          bestMatch = { appId: Number.parseInt(appId, 10), score, title };
          logger.debug(`Found match ${title} with score ${(score * 100).toFixed(0)}%`);
        }
      }

      return bestMatch?.appId ?? null;
    } catch (error) {
      if (error instanceof errors.TimeoutError) {
        logger.error("Steam search timed out");
      }
      logger.error(
        `Steam search failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    } finally {
      await page.close();
    }
  }
  public async getDetails(appId: number): Promise<NewSteamInfo> {
    const [apiData, pageData] = await Promise.all([
      this.getApiData(appId),
      this.getPageData(appId),
    ]);

    return this.mergeData(appId, apiData, pageData);
  }

  private async getApiData(appId: number): Promise<SteamApiResponse> {
    const url = new URL(SteamClient.API_URL);
    url.searchParams.set("appids", appId.toString());
    url.searchParams.set("cc", "de"); // For prices
    url.searchParams.set("l", "english"); // For descriptions
    url.searchParams.set(
      "filters",
      [
        "basic",
        "price_overview",
        "release_date",
        "genres",
        "recommendations",
        "publishers",
        "metacritic",
        "screenshots",
      ].join(","),
    );

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Steam API error: ${response.statusText}`);
    }

    return response.json() as Promise<SteamApiResponse>;
  }

  private async getPageData(appId: number): Promise<{
    percent?: number;
    score?: number;
    recommendations?: number;
  }> {
    const context = browserService.getContext();
    const page = await context.newPage();
    try {
      await page.goto(`${SteamClient.STORE_URL}/app/${appId.toFixed(0)}`, {
        timeout: 30_000,
      });
      await page.waitForSelector(".game_page_background");

      // Handle age verification if needed
      if (page.url().includes("agecheck")) {
        await page.selectOption("#ageDay", "12");
        await page.selectOption("#ageMonth", "March");
        await page.selectOption("#ageYear", "1990");
        await page.click("#view_product_page_btn");
        await page.waitForSelector(".game_page_background");
      }

      const data: {
        percent?: number;
        score?: number;
        recommendations?: number;
      } = {};

      // Get review percentage
      const reviewScore = await page
        .locator("#userReviews div[itemprop='aggregateRating']")
        .getAttribute("data-tooltip-html");

      if (reviewScore && !reviewScore.startsWith("Need more user reviews")) {
        data.percent = Number.parseInt(reviewScore.split("%")[0].trim(), 10);
      }

      // Get rating if we have percentage
      if (data.percent) {
        const rating = await page
          .locator("#userReviews [itemprop='aggregateRating'] [itemprop='ratingValue']")
          .getAttribute("content");

        if (rating) {
          data.score = Number.parseInt(rating, 10);
        }

        // Get recommendations count
        const recommendations = await page
          .locator("#userReviews [itemprop='aggregateRating'] [itemprop='reviewCount']")
          .getAttribute("content");

        if (recommendations) {
          data.recommendations = Number.parseInt(recommendations, 10);
        }
      }

      return data;
    } catch (error) {
      if (error instanceof errors.TimeoutError) {
        logger.error("Steam page load timed out");
      }
      logger.error(
        `Steam page scraping failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {};
    } finally {
      await page.close();
    }
  }

  private mergeData(
    appId: number,
    apiData: SteamApiResponse,
    pageData: { percent?: number; score?: number; recommendations?: number },
  ): NewSteamInfo {
    const data = apiData[appId.toString()].data;
    if (!data) {
      throw new Error("Invalid Steam API response");
    }

    let releaseDate: string | null = null;

    if (data.release_date) {
      try {
        releaseDate = DateTime.fromFormat(data.release_date.date, "d MMM, y", {
          zone: "UTC",
        }).toISO();
      } catch {
        logger.debug(`Couldn't parse date, trying next format: ${data.release_date.date}`);
      }

      if (!releaseDate) {
        try {
          releaseDate = DateTime.fromFormat(data.release_date.date, "y", {
            zone: "UTC",
          })
            .startOf("year")
            .toISO();
        } catch {
          logger.verbose(`Couldn't parse date, ignoring it: ${data.release_date.date}`);
        }
      }
    }

    const steamInfo: NewSteamInfo = {
      id: appId,
      url: `${SteamClient.STORE_URL}/app/${appId.toFixed(0)}`,
      name: data.name,
      short_description: data.short_description ?? null,
      release_date: releaseDate,
      genres: data.genres?.map((g) => g.description).join(", ") ?? null,
      publishers: data.publishers?.join(", ") ?? null,
      image_url:
        data.header_image ??
        data.screenshots?.[0]?.path_full.replaceAll(String.raw`\/`, "/") ??
        null,
      recommendations: data.recommendations?.total ?? pageData.recommendations ?? null,
      percent: pageData.percent ?? null,
      score: pageData.score ?? null,
      metacritic_score: data.metacritic?.score ?? null,
      metacritic_url: data.metacritic?.url.replaceAll(String.raw`\/`, "/") ?? null,
      recommended_price_eur: data.is_free
        ? 0
        : data.price_overview?.currency === "EUR"
          ? data.price_overview.initial / 100
          : null,
    };

    return steamInfo;
  }
}

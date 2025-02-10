import {
  type FeedCombination,
  getEnabledFeedCombinations,
} from "@/services/scraper/utils";
import type { Config } from "@/types/config";
import type { Offer } from "@/types/database";
import { calculateRealValidTo } from "@/utils";
import { logger } from "@/utils/logger";
import { DateTime } from "luxon";
import { getActiveOffers, getAllOffers } from "./database/offerRepository";
import { HtmlGenerator } from "./generators/html";
import { RssGenerator } from "./generators/rss";

class FeedService {
  private static instance: FeedService;
  private config: Config | null = null;

  private constructor() {
    // Private constructor to prevent instantiation
  }

  public static getInstance(): FeedService {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!FeedService.instance) {
      FeedService.instance = new FeedService();
    }
    return FeedService.instance;
  }

  public initialize(config: Config): void {
    this.config = config;
  }

  /**
   * Update feeds if new offers were found or old ones updated
   */
  public async updateFeeds(): Promise<void> {
    if (!this.config) {
      throw new Error("Feed service not initialized");
    }

    if (!this.config.actions.generateFeed) {
      return;
    }

    logger.info("Regenerating feeds.");
    const activeOffers = await getActiveOffers(DateTime.now());
    const allOffers = (await getAllOffers())
      // Skip entries without dates or entries that start in the future
      .filter(
        (offer) =>
          (offer.valid_from ?? offer.seen_last) &&
          (!offer.valid_from || offer.valid_from > offer.seen_last),
      )
      // Calculate real end dates for offers that have ended
      .map((offer) => {
        const realValidTo = calculateRealValidTo(
          DateTime.fromISO(offer.seen_last),
          offer.valid_to ? DateTime.fromISO(offer.valid_to) : null,
          DateTime.now(),
        );
        return { ...offer, valid_to: realValidTo ? realValidTo.toISO() : null };
      });

    await this.generateFeeds(activeOffers, allOffers);
  }

  public async generateFeeds(
    activeOffers: Offer[],
    allOffers: Offer[],
  ): Promise<void> {
    if (!this.config) {
      throw new Error("Feed service not initialized");
    }

    if (!this.config.actions.generateFeed) {
      logger.info("Feed generation disabled, skipping.");
      return;
    }

    const enabledCombinations: FeedCombination[] = getEnabledFeedCombinations();

    for (const combination of enabledCombinations) {
      logger.info(
        `Generating feeds for ${combination.source} ${combination.type} ${combination.duration} ${combination.platform}.`,
      );

      await this.generateSourceFeed(combination, activeOffers, allOffers);
    }

    // Generate main feed with all offers
    logger.info("Generating main feed.");
    await this.generateMainFeed(activeOffers, allOffers);
  }

  private async generateSourceFeed(
    combination: FeedCombination,
    activeOffers: Offer[],
    allOffers: Offer[],
  ): Promise<void> {
    if (!this.config) {
      throw new Error("Feed service not initialized");
    }

    const filteredActiveOffers = activeOffers.filter(
      (offer) =>
        offer.source === combination.source &&
        offer.type === combination.type &&
        offer.duration === combination.duration &&
        offer.platform === combination.platform,
    );

    const filteredAllOffers = allOffers.filter(
      (offer) =>
        offer.source === combination.source &&
        offer.type === combination.type &&
        offer.duration === combination.duration &&
        offer.platform === combination.platform,
    );
    // Generate RSS feed
    const feedGen = new RssGenerator(this.config, combination);
    await feedGen.generateFeed(filteredActiveOffers);

    // Generate HTML views
    const htmlGen = new HtmlGenerator(this.config, { combination });
    await htmlGen.generateHtml(filteredActiveOffers);

    // Generate full history HTML view
    const htmlHistoryGen = new HtmlGenerator(this.config, {
      combination,
      withHistory: true,
    });
    await htmlHistoryGen.generateHtml(filteredAllOffers);
  }

  private async generateMainFeed(
    activeOffers: Offer[],
    allOffers: Offer[],
  ): Promise<void> {
    if (!this.config) {
      throw new Error("Feed service not initialized");
    }

    // Generate main RSS feed
    const feedGen = new RssGenerator(this.config);
    await feedGen.generateFeed(activeOffers);

    // Generate main HTML view
    const htmlGen = new HtmlGenerator(this.config);
    await htmlGen.generateHtml(activeOffers);

    // Generate full history HTML view
    const htmlHistoryGen = new HtmlGenerator(this.config, {
      withHistory: true,
    });
    await htmlHistoryGen.generateHtml(allOffers);
  }
}

export const feedService = FeedService.getInstance();

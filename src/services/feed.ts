import { getEnabledScraperCombinations } from "@/scrapers";
import type { ScraperCombination } from "@/scrapers/utils";
import type { Config } from "@/types/config";
import type { Offer } from "@/types/database";
import { logger } from "@/utils/logger";
import { HtmlGenerator } from "./generators/html";
import { RssGenerator } from "./generators/rss";

export class FeedService {
  constructor(private readonly config: Config) {}

  public async generateFeeds(
    activeOffers: Offer[],
    allOffers: Offer[],
  ): Promise<void> {
    if (!this.config.actions.generateFeed) {
      logger.info("Feed generation disabled, skipping");
      return;
    }

    const enabledCombinations: ScraperCombination[] =
      getEnabledScraperCombinations();

    for (const combination of enabledCombinations) {
      await this.generateSourceFeed(combination, activeOffers, allOffers);
    }

    // Generate main feed with all offers
    await this.generateMainFeed(activeOffers, allOffers);
  }

  private async generateSourceFeed(
    combination: ScraperCombination,
    activeOffers: Offer[],
    allOffers: Offer[],
  ): Promise<void> {
    const filteredActiveOffers = activeOffers.filter(
      (offer) =>
        offer.source === combination.source &&
        offer.type === combination.type &&
        offer.duration === combination.duration,
    );

    const filteredAllOffers = allOffers.filter(
      (offer) =>
        offer.source === combination.source &&
        offer.type === combination.type &&
        offer.duration === combination.duration,
    );

    // Generate Atom feed
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
    // Generate main Atom feed
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

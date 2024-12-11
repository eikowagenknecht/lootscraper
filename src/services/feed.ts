import type { Config } from "@/types/config";
import type { OfferDuration, OfferSource, OfferType } from "@/types/config";
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

    // Generate source-specific feeds
    for (const source of this.config.scraper.offerSources) {
      for (const type of this.config.scraper.offerTypes) {
        for (const duration of this.config.scraper.offerDurations) {
          await this.generateSourceFeed(
            source,
            type,
            duration,
            activeOffers,
            allOffers,
          );
        }
      }
    }

    // Generate main feed with all offers
    await this.generateMainFeed(activeOffers, allOffers);
  }

  private async generateSourceFeed(
    source: OfferSource,
    type: OfferType,
    duration: OfferDuration,
    activeOffers: Offer[],
    allOffers: Offer[],
  ): Promise<void> {
    const filteredActiveOffers = activeOffers.filter(
      (offer) =>
        offer.source === source &&
        offer.type === type &&
        offer.duration === duration,
    );

    const filteredAllOffers = allOffers.filter(
      (offer) =>
        offer.source === source &&
        offer.type === type &&
        offer.duration === duration,
    );

    if (filteredAllOffers.length === 0) return;

    const includeFilter = { source, type, duration };

    // Generate Atom feed
    const feedGen = new RssGenerator(this.config, includeFilter);
    await feedGen.generateFeed(filteredActiveOffers);

    // Generate HTML views
    const htmlGen = new HtmlGenerator(this.config, includeFilter);
    await htmlGen.generateHtml(filteredActiveOffers);

    // Generate full history HTML view
    const htmlHistoryGen = new HtmlGenerator(this.config, {
      ...includeFilter,
      all: true,
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
      all: true,
    });
    await htmlHistoryGen.generateHtml(allOffers);
  }
}

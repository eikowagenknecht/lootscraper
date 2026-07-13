import { DateTime, Settings as LuxonSettings } from "luxon";
import type { BrowserContext } from "playwright";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { browserService } from "@/services/browser";
import { config } from "@/services/config";

import { FabAssetsScraper } from "./fab";

vi.mock("@/services/browser", () => ({
  browserService: {
    getContext: vi.fn(),
  },
}));

function makeListing(overrides: Record<string, unknown> = {}) {
  return {
    title: "Science Fiction Desert City Kit",
    uid: "81880856-a0e1-492f-8686-3afbda15ab43",
    listingType: "3d-model",
    startingPrice: { price: 79.99 },
    thumbnails: [
      {
        mediaUrl: "https://media.fab.com/image_previews/gallery_images/full.jpg",
        images: [
          { url: "https://media.fab.com/image_previews/gallery_images/small.jpg", width: 160 },
          { url: "https://media.fab.com/image_previews/gallery_images/large.jpg", width: 1280 },
        ],
      },
    ],
    ...overrides,
  };
}

function makeBlade(overrides: Record<string, unknown> = {}) {
  const endDate = DateTime.now()
    .setZone("America/New_York")
    .plus({ days: 7 })
    .toFormat("MMMM d 'at' h:mm a");
  return {
    title: `Limited-Time Free (Until ${endDate} ET)`,
    tiles: [{ listing: makeListing() }],
    ...overrides,
  };
}

function mockBladeFetch(result: unknown) {
  const page = {
    goto: vi.fn().mockResolvedValue(null),
    evaluate: vi.fn().mockResolvedValue(result),
    close: vi.fn(),
  };
  vi.mocked(browserService.getContext).mockReturnValue({
    newPage: vi.fn().mockResolvedValue(page),
  } as unknown as BrowserContext);
  return page;
}

describe("Fab Assets Scraper", () => {
  beforeAll(() => {
    config.loadConfig();
  });

  const luxonNow = LuxonSettings.now;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    LuxonSettings.now = luxonNow;
  });

  test("should map blade tiles to offers", async () => {
    mockBladeFetch({ status: 200, blade: makeBlade() });

    const scraper = new FabAssetsScraper(config.get());
    const offers = await scraper.readOffers();

    expect(offers).toHaveLength(1);
    const offer = offers[0];
    expect(offer.title).toBe("Science Fiction Desert City Kit");
    expect(offer.probable_game_name).toBe("");
    expect(offer.url).toBe("https://www.fab.com/listings/81880856-a0e1-492f-8686-3afbda15ab43");
    expect(offer.img_url).toBe("https://media.fab.com/image_previews/gallery_images/full.jpg");
    expect(offer.valid_to).toBeTruthy();
    // The end date in the fixture blade title is 7 days in the future.
    const validTo = DateTime.fromISO(offer.valid_to ?? "");
    expect(validTo > DateTime.now().plus({ days: 6 })).toBe(true);
    expect(validTo < DateTime.now().plus({ days: 8 })).toBe(true);
  });

  test("should skip tiles without a listing and fall back to the largest image", async () => {
    mockBladeFetch({
      status: 200,
      blade: makeBlade({
        tiles: [
          { listing: null },
          {
            listing: makeListing({
              thumbnails: [
                {
                  mediaUrl: null,
                  images: [
                    { url: "https://media.fab.com/small.jpg", width: 160 },
                    { url: "https://media.fab.com/large.jpg", width: 1280 },
                  ],
                },
              ],
            }),
          },
        ],
      }),
    });

    const scraper = new FabAssetsScraper(config.get());
    const offers = await scraper.readOffers();

    expect(offers).toHaveLength(1);
    expect(offers[0].img_url).toBe("https://media.fab.com/large.jpg");
  });

  test("should roll the end date over to the next year when needed", async () => {
    // A January end date scraped in December belongs to the next year.
    LuxonSettings.now = () => new Date("2026-12-20T12:00:00Z").getTime();
    mockBladeFetch({
      status: 200,
      blade: makeBlade({ title: "Limited-Time Free (Until January 3 at 9:59 AM ET)" }),
    });

    const scraper = new FabAssetsScraper(config.get());
    const offers = await scraper.readOffers();

    expect(offers).toHaveLength(1);
    expect(DateTime.fromISO(offers[0].valid_to ?? "").year).toBe(2027);
  });

  test("should return offers without an end date when the title is unparseable", async () => {
    mockBladeFetch({
      status: 200,
      blade: makeBlade({ title: "Limited-Time Free" }),
    });

    const scraper = new FabAssetsScraper(config.get());
    const offers = await scraper.readOffers();

    expect(offers).toHaveLength(1);
    expect(offers[0].valid_to).toBeNull();
  });

  test("should throw when the API returns an error", async () => {
    mockBladeFetch({ status: 403 });

    const scraper = new FabAssetsScraper(config.get());
    await expect(scraper.readOffers()).rejects.toThrow("Fab API returned 403");
  });

  test("should throw when the API response has no tiles", async () => {
    mockBladeFetch({ status: 200, blade: { title: "Limited-Time Free" } });

    const scraper = new FabAssetsScraper(config.get());
    await expect(scraper.readOffers()).rejects.toThrow("No tiles returned from the Fab API");
  });

  test("should close the page even when reading offers fails", async () => {
    const page = mockBladeFetch({ status: 500 });

    const scraper = new FabAssetsScraper(config.get());
    await expect(scraper.readOffers()).rejects.toThrow();
    expect(page.close).toHaveBeenCalled();
  });
});

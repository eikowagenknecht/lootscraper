import type { Browser, BrowserContext } from "playwright";
import { firefox } from "playwright";
import type { Config } from "@/types/config";
import { BrowserError } from "@/types/errors";

const CONTEXT_OPTIONS = {
  // Use Reykjavik timezone (=UTC) because UTC is not supported directly
  timezoneId: "Atlantic/Reykjavik",
  // Set locale to en-US to get the english pages
  locale: "en-US",
};

class BrowserService {
  private static instance: BrowserService;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private timeoutSeconds: number | null = null;
  private loadImages: boolean | null = null;
  private browserStartTime: Date | null = null;
  private scrapeCount = 0;

  // Restart browser after this many scrapes to prevent memory accumulation
  private readonly MAX_SCRAPES_BEFORE_RESTART = 50;
  // Or restart after this many hours
  private readonly MAX_HOURS_BEFORE_RESTART = 24;

  private constructor() {
    // Private constructor to prevent instantiation
  }

  public static getInstance(): BrowserService {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!BrowserService.instance) {
      BrowserService.instance = new BrowserService();
    }
    return BrowserService.instance;
  }

  public async initialize(config: Config): Promise<void> {
    try {
      this.browser = await firefox.launch({
        headless: config.browser.headless,
      });

      // Set default timeout from config
      this.timeoutSeconds = config.browser.timeoutSeconds;
      this.loadImages = config.browser.loadImages;

      // Track when browser was started
      this.browserStartTime = new Date();
      this.scrapeCount = 0;

      await this.refreshContext();
    } catch (error) {
      throw new BrowserError(
        `Failed to initialize browser: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  public isInitialized(): boolean {
    return this.browser?.isConnected() ?? false;
  }

  public getContext(): BrowserContext {
    if (!this.context) {
      throw new BrowserError(
        "Browser context not initialized. Call initialize() first.",
      );
    }
    return this.context;
  }

  public async refreshContext(): Promise<void> {
    if (
      !this.browser ||
      this.timeoutSeconds === null ||
      this.loadImages === null
    ) {
      throw new BrowserError(
        "Browser not initialized. Call initialize() first.",
      );
    }

    // Check if browser is still connected (not crashed or terminated)
    if (!this.browser.isConnected()) {
      // Clear the reference to the dead browser
      this.browser = null;
      this.context = null;
      throw new BrowserError(
        "Browser has been disconnected or terminated. Please reinitialize.",
      );
    }

    // Close the current context if it exists
    if (this.context) {
      try {
        await this.context.close();
      } catch (error) {
        // Log but don't fail if context close fails
        throw new BrowserError(
          `Failed to close browser context: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const newContext = await this.browser.newContext(CONTEXT_OPTIONS);

    if (!this.loadImages) {
      // Skip images
      await newContext.route("**/*", (route) => {
        const url = route.request().url();
        const isImageExtension = /\.(png|jpg|jpeg|gif|webp|svg|ico)$/i.test(
          url,
        );
        const isImageResource = route.request().resourceType() === "image";

        // Block if either condition is true
        if (isImageExtension || isImageResource) {
          return route.abort();
        }
        return route.continue();
      });
    }

    // Set default timeout from config (in ms)
    newContext.setDefaultTimeout(this.timeoutSeconds * 1000);

    this.context = newContext;
  }

  public async destroy(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    this.browserStartTime = null;
    this.scrapeCount = 0;
  }

  /**
   * Check if browser should be restarted to prevent memory accumulation.
   * @returns true if browser has been running too long or processed too many scrapes.
   */
  public shouldRestartBrowser(): boolean {
    if (!this.browserStartTime) {
      return false;
    }

    // Check scrape count
    if (this.scrapeCount >= this.MAX_SCRAPES_BEFORE_RESTART) {
      return true;
    }

    // Check uptime
    const uptimeHours =
      (Date.now() - this.browserStartTime.getTime()) / (1000 * 60 * 60);
    if (uptimeHours >= this.MAX_HOURS_BEFORE_RESTART) {
      return true;
    }

    return false;
  }

  /**
   * Increment the scrape counter. Should be called after each scrape.
   */
  public incrementScrapeCount(): void {
    this.scrapeCount++;
  }

  /**
   * Get browser uptime statistics for logging
   * @returns Object containing scrape count and uptime in hours
   */
  public getStats(): { scrapeCount: number; uptimeHours: number } {
    const uptimeHours = this.browserStartTime
      ? (Date.now() - this.browserStartTime.getTime()) / (1000 * 60 * 60)
      : 0;
    return {
      scrapeCount: this.scrapeCount,
      uptimeHours: Math.round(uptimeHours * 100) / 100,
    };
  }
}

// Export a singleton instance
export const browserService = BrowserService.getInstance();

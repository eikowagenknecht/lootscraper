import type { Config } from "@/types/config";
import { BrowserError } from "@/types/errors";
import type { Browser, BrowserContext } from "playwright";
import { firefox } from "playwright";

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

      await this.refreshContext();
    } catch (error) {
      throw new BrowserError(
        `Failed to initialize browser: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  public isInitialized(): boolean {
    return this.browser !== null;
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

    // Close the current context if it exists
    if (this.context) {
      await this.context.close();
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
  }
}

// Export a singleton instance
export const browserService = BrowserService.getInstance();

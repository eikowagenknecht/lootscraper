import type { Config } from "@/types/config";
import { BrowserError } from "@/types/errors";
import { logger } from "@/utils/logger";
import type { Browser, BrowserContext } from "playwright";
import { firefox } from "playwright";

export class BrowserService {
  private static instance: BrowserService;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

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
        headless: config.expert.headless,
      });

      this.context = await this.browser.newContext({
        // Use Reykjavik timezone (=UTC) because UTC is not supported directly
        timezoneId: "Atlantic/Reykjavik",
        // Set locale to en-US to get the english pages
        locale: "en-US",
      });

      // Set default timeout from config (in ms)
      this.context.setDefaultTimeout(config.expert.webTimeoutSeconds * 1000);

      logger.info("Browser service initialized");
    } catch (error) {
      throw new BrowserError(
        `Failed to initialize browser: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  public getContext(): BrowserContext {
    if (!this.context) {
      throw new BrowserError(
        "Browser context not initialized. Call initialize() first.",
      );
    }
    return this.context;
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
export const browser = BrowserService.getInstance();

import { OfferDuration, type OfferSource, type OfferType } from "@/types/basic";
import { init, t } from "i18next";

const resources = {
  en: {
    translation: {
      sources: {
        APPLE: "Apple App Store",
        AMAZON: "Amazon Prime",
        EPIC: "Epic Games",
        GOG: "GOG",
        GOOGLE: "Google Play Store",
        HUMBLE: "Humble Bundle",
        ITCH: "itch.io",
        STEAM: "Steam",
        UBISOFT: "Ubisoft",
      },
      types: {
        GAME_one: "Game",
        GAME_other: "Games",
        LOOT: "Loot",
      },
      durations: {
        CLAIMABLE: "Permanent after Claim",
        ALWAYS: "Always Free",
        TEMPORARY: "Temporary",
      },
      feed: {
        title: "Free {{source}} {{type}}",
        titleAll: "Free Games and Loot",
        titleWithDuration: "Free {{source}} {{type}} ({{duration}})",
      },
    },
  },
};

class TranslationService {
  private static instance: TranslationService;
  private initialized = false;

  private constructor() {
    // Private constructor to prevent direct construction calls with the `new` operator
  }

  public static getInstance(): TranslationService {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!TranslationService.instance) {
      TranslationService.instance = new TranslationService();
    }
    return TranslationService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await init({
        resources,
        lng: "en", // Default language
        fallbackLng: "en",
        interpolation: {
          escapeValue: false,
        },
      });

      this.initialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize translation service: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  public checkInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        "Translation service not initialized. Call initialize() first.",
      );
    }
  }

  public getSourceDisplay(source: OfferSource): string {
    this.checkInitialized();
    return t(`sources.${source}`);
  }

  public getTypeDisplay(type: OfferType, count = 1): string {
    this.checkInitialized();
    return t(`types.${type}`, { count });
  }

  public getDurationDisplay(duration: OfferDuration): string {
    this.checkInitialized();
    return t(`durations.${duration}`);
  }

  public getFeedTitle(
    source?: OfferSource,
    type?: OfferType,
    duration?: OfferDuration,
  ): string {
    this.checkInitialized();
    if (!source || !type) {
      return t("feed.titleAll");
    }

    const context = {
      source: this.getSourceDisplay(source),
      type: this.getTypeDisplay(type, 2), // Use count=2 for plural in feed titles
    };

    if (duration && duration !== OfferDuration.CLAIMABLE) {
      return t("feed.titleWithDuration", {
        ...context,
        duration: this.getDurationDisplay(duration),
      });
    }

    return t("feed.title", context);
  }
}

export const translationService = TranslationService.getInstance();

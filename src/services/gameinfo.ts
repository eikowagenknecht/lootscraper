import type { Config } from "@/types/config";
import type { Game, NewIgdbInfo, NewSteamInfo } from "@/types/database";

import { InfoSource } from "@/types";
import { logger } from "@/utils/logger";

import { createGame, getGameByIgdbName, getGameBySteamName } from "./database/gameRepository";
import { createIgdbInfo } from "./database/igdbInfoRepository";
import { getOfferById, updateOffer } from "./database/offerRepository";
import { createSteamInfo } from "./database/steamInfoRepository";
import { IgdbClient } from "./gameinfo/igdb/igdb";
import { SteamClient } from "./gameinfo/steam/steam";

class GameInfoService {
  private static instance: GameInfoService;
  private config: Config | null = null;
  private steamClient: SteamClient | null = null;
  private igdbClient: IgdbClient | null = null;
  private running = false;

  private constructor() {
    // Private constructor to prevent instantiation
  }

  public static getInstance(): GameInfoService {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!GameInfoService.instance) {
      GameInfoService.instance = new GameInfoService();
    }
    return GameInfoService.instance;
  }

  public initialize(config: Config): void {
    this.config = config;
    this.steamClient = new SteamClient();
    this.igdbClient =
      config.igdb.clientId && config.igdb.clientSecret
        ? new IgdbClient(config.igdb.clientId, config.igdb.clientSecret)
        : null;
  }

  public isRunning() {
    return this.running;
  }

  /**
   * Update an offer with game information. If the offer already has some
   * information, just update the missing parts. Otherwise, create a new
   * Game and try to populate it with information.
   * @param offerId The ID of the offer to enrich.
   * @returns A promise that resolves when the enrichment is done.
   */
  public async enrichOffer(offerId: number): Promise<void> {
    if (this.running) {
      logger.error("Game Info service can only process one item at a time.");
    }

    this.running = true;

    const offer = await getOfferById(offerId);
    if (!offer) {
      logger.warn(`Offer with ID ${offerId.toFixed(0)} not found, skipping enrichment.`);
      this.running = false;
      return;
    }

    if (!offer.probable_game_name) {
      logger.warn("Offer has no game name, skipping enrichment.");
      this.running = false;
      return;
    }

    const existingGame = await this.findExistingGame(offer.probable_game_name);
    if (existingGame) {
      logger.verbose("Game info already exists, using existing info.");
      await updateOffer(offer.id, { game_id: existingGame.id });
      this.running = false;
      return;
    }

    const [steamInfo, igdbInfo] = await Promise.all([
      this.getSteamInfo(offer.probable_game_name),
      this.getIgdbInfo(offer.probable_game_name),
    ]);

    if (!steamInfo && !igdbInfo) {
      logger.info(`No game info found for ${offer.probable_game_name}.`);
      this.running = false;
      return;
    }

    logger.info(`Enriching ${offer.probable_game_name} with game info.`);

    if (steamInfo) {
      await createSteamInfo(steamInfo);
    }
    if (igdbInfo) {
      await createIgdbInfo(igdbInfo);
    }
    const newGame = await createGame({
      steam_id: steamInfo?.id ?? null,
      igdb_id: igdbInfo?.id ?? null,
    });

    await updateOffer(offer.id, { game_id: newGame });

    this.running = false;
  }

  private async findExistingGame(gameName: string): Promise<Game | null> {
    if (!this.config) {
      throw new Error("GameInfo service not initialized");
    }

    if (this.config.scraper.infoSources.includes(InfoSource.IGDB)) {
      const gameByIgdb = await getGameByIgdbName(gameName);
      if (gameByIgdb) {
        return gameByIgdb;
      }
    }

    if (this.config.scraper.infoSources.includes(InfoSource.STEAM)) {
      const gameBySteam = await getGameBySteamName(gameName);
      if (gameBySteam) {
        return gameBySteam;
      }
    }

    return null;
  }

  private async getSteamInfo(gameName: string): Promise<NewSteamInfo | null> {
    if (!this.config || !this.steamClient) {
      throw new Error("GameInfo service not initialized");
    }

    if (!this.config.scraper.infoSources.includes(InfoSource.STEAM)) {
      return null;
    }
    logger.debug(`Fetching Steam info for: ${gameName}`);

    try {
      const appId = await this.steamClient.findSteamId(gameName);
      if (!appId) {
        return null;
      }

      const details = await this.steamClient.getDetails(appId);
      if (!details.name) {
        logger.warn(`Steam API returned no name for ${appId.toFixed(0)}`);
        return null;
      }

      return details;
    } catch (error) {
      logger.error(
        `Steam info fetch failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private async getIgdbInfo(gameName: string): Promise<NewIgdbInfo | null> {
    if (!this.config) {
      throw new Error("GameInfo service not initialized");
    }

    if (!this.igdbClient || !this.config.scraper.infoSources.includes(InfoSource.IGDB)) {
      return null;
    }
    logger.debug(`Fetching IGDB info for: ${gameName}`);

    try {
      const gameId = await this.igdbClient.searchGame(gameName);
      if (!gameId) {
        return null;
      }
      logger.debug(`Found IDGB game ID ${gameId.toFixed(0)} for: ${gameName}`);

      return await this.igdbClient.getDetails(gameId);
    } catch (error) {
      logger.error(
        `IGDB info fetch failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}

export const gameInfoService = GameInfoService.getInstance();

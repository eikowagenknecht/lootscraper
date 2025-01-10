import type { Config } from "@/types/config";
import type {
  Game,
  NewGame,
  NewIgdbInfo,
  NewSteamInfo,
  Offer,
} from "@/types/database";
import { logger } from "@/utils/logger";
import {
  createGame,
  getGameByIgdbName,
  getGameBySteamName,
} from "./database/gameRepository";
import { createIgdbInfo } from "./database/igdbInfoRepository";
import { getOfferById, updateOffer } from "./database/offerRepository";
import { createSteamInfo } from "./database/steamInfoRepository";
import { IgdbClient } from "./gameinfo/igdb/igdb";
import { SteamClient } from "./gameinfo/steam/steam";

export class GameInfoService {
  private readonly steamClient: SteamClient;
  private readonly igdbClient: IgdbClient | null;

  constructor(private readonly config: Config) {
    this.steamClient = new SteamClient();
    this.igdbClient =
      config.igdb.clientId && config.igdb.clientSecret
        ? new IgdbClient(config.igdb.clientId, config.igdb.clientSecret)
        : null;
  }

  /**
   * Update an offer with game information. If the offer already has some
   * information, just update the missing parts. Otherwise, create a new
   * Game and try to populate it with information.
   * @param offer
   * @returns
   */
  public async enrichOffer(offer: number | Offer): Promise<void> {
    let innerOffer: Offer;
    if (typeof offer === "number") {
      const dbOffer = await getOfferById(offer);
      if (!dbOffer) {
        logger.warn(
          `Offer with ID ${offer.toFixed()} not found, skipping enrichment.`,
        );
        return;
      }
      innerOffer = dbOffer;
    } else {
      innerOffer = offer;
    }

    if (!innerOffer.probable_game_name) {
      logger.warn("Offer has no game name, skipping enrichment.");
      return;
    }

    const existingGame = await this.findExistingGame(
      innerOffer.probable_game_name,
    );
    if (existingGame) {
      innerOffer.game_id = existingGame.id;
      return;
    }

    const [steamInfo, igdbInfo] = await Promise.all([
      this.getSteamInfo(innerOffer.probable_game_name),
      this.getIgdbInfo(innerOffer.probable_game_name),
    ]);

    if (!steamInfo && !igdbInfo) {
      logger.info(`No game info found for: ${innerOffer.probable_game_name}`);
      return;
    }

    const newGame = await this.saveGameInfo(steamInfo, igdbInfo);
    await updateOffer(innerOffer.id, { game_id: newGame });
  }

  private async findExistingGame(gameName: string): Promise<Game | null> {
    if (this.config.scraper.infoSources.includes("IGDB")) {
      const gameByIgdb = await getGameByIgdbName(gameName);
      if (gameByIgdb) return gameByIgdb;
    }

    if (this.config.scraper.infoSources.includes("STEAM")) {
      const gameBySteam = await getGameBySteamName(gameName);
      if (gameBySteam) return gameBySteam;
    }

    return null;
  }

  private async getSteamInfo(gameName: string): Promise<NewSteamInfo | null> {
    if (!this.config.scraper.infoSources.includes("STEAM")) return null;
    logger.debug(`Fetching Steam info for: ${gameName}`);

    try {
      const appId = await this.steamClient.findSteamId(gameName);
      if (!appId) return null;

      const details = await this.steamClient.getDetails(appId);
      if (!details.name) {
        logger.warn(`Steam API returned no name for ${appId.toFixed()}`);
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
    if (!this.igdbClient || !this.config.scraper.infoSources.includes("IGDB")) {
      return null;
    }
    logger.debug(`Fetching IGDB info for: ${gameName}`);

    try {
      const gameId = await this.igdbClient.searchGame(gameName);
      if (!gameId) return null;
      logger.debug(`Found IDGB game ID ${gameId.toFixed()} for: ${gameName}`);

      return await this.igdbClient.getDetails(gameId);
    } catch (error) {
      logger.error(
        `IGDB info fetch failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private async saveGameInfo(
    steamInfo: NewSteamInfo | null,
    igdbInfo: NewIgdbInfo | null,
  ): Promise<number> {
    const game: NewGame = {
      steam_id: steamInfo?.id ?? null,
      igdb_id: igdbInfo?.id ?? null,
    };

    // Create game info first as it's required for the game
    if (steamInfo) {
      await createSteamInfo(steamInfo);
    }

    if (igdbInfo) {
      await createIgdbInfo(igdbInfo);
    }

    return await createGame(game);
  }
}

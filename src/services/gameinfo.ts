import type { DatabaseOperations } from "@/services/database/operations";
import type { Config } from "@/types/config";
import type {
  Game,
  NewGame,
  NewIgdbInfo,
  NewOffer,
  NewSteamInfo,
} from "@/types/database";
import { logger } from "@/utils/logger";
import type { BrowserContext } from "playwright";
import { IgdbClient } from "./gameinfo/igdb/igdb";
import { SteamClient } from "./gameinfo/steam/steam";

export class GameInfoService {
  private readonly steamClient: SteamClient;
  private readonly igdbClient: IgdbClient | null;

  constructor(
    private readonly config: Config,
    private readonly dbOps: DatabaseOperations,
    readonly browserContext: BrowserContext,
  ) {
    this.steamClient = new SteamClient(browserContext);
    this.igdbClient =
      config.igdb.clientId && config.igdb.clientSecret
        ? new IgdbClient(config.igdb.clientId, config.igdb.clientSecret)
        : null;
  }

  public async enrichOffer(offer: NewOffer): Promise<void> {
    if (!offer.probable_game_name) {
      logger.warn("Offer has no game name, skipping enrichment");
      return;
    }

    const existingGame = await this.findExistingGame(offer.probable_game_name);
    if (existingGame) {
      offer.game_id = existingGame.id;
      return;
    }

    const [steamInfo, igdbInfo] = await Promise.all([
      this.getSteamInfo(offer.probable_game_name),
      this.getIgdbInfo(offer.probable_game_name),
    ]);

    if (!steamInfo && !igdbInfo) {
      logger.info(`No game info found for: ${offer.probable_game_name}`);
      return;
    }

    const newGame = await this.saveGameInfo(steamInfo, igdbInfo);
    offer.game_id = newGame.id;
  }
  private async findExistingGame(gameName: string): Promise<Game | null> {
    if (this.config.scraper.infoSources.includes("IGDB")) {
      const gameByIgdb = await this.dbOps.findGameByIgdbName(gameName);
      if (gameByIgdb) return gameByIgdb;
    }

    if (this.config.scraper.infoSources.includes("STEAM")) {
      const gameBySteam = await this.dbOps.findGameBySteamName(gameName);
      if (gameBySteam) return gameBySteam;
    }

    return null;
  }

  private async getSteamInfo(gameName: string): Promise<NewSteamInfo | null> {
    if (!this.config.scraper.infoSources.includes("STEAM")) return null;

    try {
      const appId = await this.steamClient.findSteamId(gameName);
      if (!appId) return null;

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
    if (!this.igdbClient || !this.config.scraper.infoSources.includes("IGDB")) {
      return null;
    }

    try {
      const gameId = await this.igdbClient.searchGame(gameName);
      if (!gameId) return null;

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
  ): Promise<Game> {
    const game: NewGame = {
      steam_id: steamInfo?.id ?? null,
      igdb_id: igdbInfo?.id ?? null,
    };

    const newGameId = await this.dbOps.createGame(game);
    const savedGame = await this.dbOps.getGame(newGameId);

    if (savedGame === null) {
      throw new Error("Failed to save game info");
    }

    if (steamInfo) {
      await this.dbOps.createSteamInfo(steamInfo);
    }

    if (igdbInfo) {
      await this.dbOps.createIgdbInfo(igdbInfo);
    }

    return savedGame;
  }
}

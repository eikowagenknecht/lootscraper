import type { NewSteamInfo } from "@/types/database";
import { BaseRepository } from "./baseRepository";

export class SteamInfoRepository extends BaseRepository {
  async create(info: NewSteamInfo): Promise<number> {
    try {
      const result = await this.db
        .insertInto("steam_info")
        .values(info)
        .executeTakeFirstOrThrow();
      return this.handleInsertResult(result);
    } catch (error) {
      this.handleError("create Steam info", error);
    }
  }
}

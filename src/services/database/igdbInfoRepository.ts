import type { NewIgdbInfo } from "@/types/database";
import { BaseRepository } from "./baseRepository";

export class IgdbInfoRepository extends BaseRepository {
  async create(info: NewIgdbInfo): Promise<number> {
    try {
      const result = await this.db
        .insertInto("igdb_info")
        .values(info)
        .executeTakeFirstOrThrow();
      return this.handleInsertResult(result);
    } catch (error) {
      this.handleError("create IGDB info", error);
    }
  }
}

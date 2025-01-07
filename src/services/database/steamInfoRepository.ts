import { getDb } from "@/services/database";
import type { NewSteamInfo, SteamInfo } from "@/types/database";
import { handleError, handleInsertResult } from "./common";

export async function getSteamInfoById(id: number): Promise<SteamInfo | null> {
  try {
    return (
      (await getDb()
        .selectFrom("steam_info")
        .where("id", "=", id)
        .selectAll()
        .executeTakeFirst()) ?? null
    );
  } catch (error) {
    handleError("get Steam info", error);
  }
}

export async function createSteamInfo(info: NewSteamInfo): Promise<number> {
  try {
    const result = await getDb()
      .insertInto("steam_info")
      .values(info)
      .executeTakeFirstOrThrow();
    return handleInsertResult(result);
  } catch (error) {
    handleError("create Steam info", error);
  }
}

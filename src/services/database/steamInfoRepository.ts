import type { NewSteamInfo } from "@/types/database";
import { getDb } from "../database";
import { handleError, handleInsertResult } from "./common";

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

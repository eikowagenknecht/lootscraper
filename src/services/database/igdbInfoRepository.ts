import type { NewIgdbInfo } from "@/types/database";
import { getDb } from "../database";
import { handleError, handleInsertResult } from "./common";

export async function createIgdbInfo(info: NewIgdbInfo): Promise<number> {
  try {
    const result = await getDb()
      .insertInto("igdb_info")
      .values(info)
      .executeTakeFirstOrThrow();
    return handleInsertResult(result);
  } catch (error) {
    handleError("create IGDB info", error);
  }
}

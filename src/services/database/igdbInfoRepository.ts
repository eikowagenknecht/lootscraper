import type { IgdbInfo, NewIgdbInfo } from "@/types/database";
import { getDb } from "../database";
import { handleError, handleInsertResult } from "./common";

export async function getIgdbInfoById(id: number): Promise<IgdbInfo | null> {
  try {
    return (
      (await getDb()
        .selectFrom("igdb_info")
        .where("id", "=", id)
        .selectAll()
        .executeTakeFirst()) ?? null
    );
  } catch (error) {
    handleError("get IGDB info", error);
  }
}

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

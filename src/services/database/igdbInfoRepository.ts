import { getDb } from "@/services/database";
import type { IgdbInfo, IgdbInfoUpdate, NewIgdbInfo } from "@/types/database";
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

async function updateIgdbInfo(id: number, info: IgdbInfoUpdate): Promise<void> {
  try {
    await getDb()
      .updateTable("igdb_info")
      .set(info)
      .where("id", "=", id)
      .executeTakeFirst();
  } catch (error) {
    handleError("update IGDB info", error);
  }
}

export async function createIgdbInfo(info: NewIgdbInfo): Promise<number> {
  const existingInfo = await getIgdbInfoById(info.id);

  if (existingInfo) {
    await updateIgdbInfo(existingInfo.id, info);
    return existingInfo.id;
  }

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

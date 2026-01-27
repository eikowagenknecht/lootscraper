import type { NewSteamInfo, SteamInfo, SteamInfoUpdate } from "@/types/database";

import { getDb } from "@/services/database";

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

async function updateSteamInfo(id: number, info: SteamInfoUpdate): Promise<void> {
  try {
    await getDb().updateTable("steam_info").set(info).where("id", "=", id).executeTakeFirst();
  } catch (error) {
    handleError("update Steam info", error);
  }
}

export async function createSteamInfo(info: NewSteamInfo): Promise<number> {
  const existingInfo = await getSteamInfoById(info.id);

  if (existingInfo) {
    await updateSteamInfo(existingInfo.id, info);
    return existingInfo.id;
  }

  try {
    const result = await getDb().insertInto("steam_info").values(info).executeTakeFirstOrThrow();
    return handleInsertResult(result);
  } catch (error) {
    handleError("create Steam info", error);
  }
}

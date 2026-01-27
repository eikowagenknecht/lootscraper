import type { Hash, HashUpdate, NewHash } from "@/types";

import { getDb } from "@/services/database";

import { handleError, handleInsertResult } from "./common";

export async function getHashByResourceName(name: string): Promise<Hash | null> {
  try {
    return (
      (await getDb()
        .selectFrom("hashes")
        .where("resource_name", "=", name)
        .selectAll()
        .executeTakeFirst()) ?? null
    );
  } catch (error) {
    handleError("get hash by resource name", error);
  }
}
export async function createHash(hash: NewHash): Promise<number> {
  const existingHash = await getHashByResourceName(hash.resource_name);

  if (existingHash) {
    await updateHash(existingHash.id, {
      hash_value: hash.hash_value,
      last_updated: hash.last_updated,
    });
    return existingHash.id;
  }

  try {
    const result = await getDb().insertInto("hashes").values(hash).executeTakeFirstOrThrow();
    return handleInsertResult(result);
  } catch (error) {
    handleError("create hash", error);
  }
}

async function updateHash(id: number, hash: HashUpdate): Promise<boolean> {
  try {
    const result = await getDb()
      .updateTable("hashes")
      .set(hash)
      .where("id", "=", id)
      .executeTakeFirst();
    return result.numUpdatedRows > 0;
  } catch (error) {
    handleError("update hash", error);
  }
}

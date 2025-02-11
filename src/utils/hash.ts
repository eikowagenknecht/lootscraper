import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";

export async function generateFileHash(filePath: string): Promise<string> {
  const hash = createHash("md5");
  const stream = createReadStream(filePath);

  await pipeline(stream, hash);
  return hash.digest("hex");
}

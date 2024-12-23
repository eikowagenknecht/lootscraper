import { existsSync } from "node:fs";
import { resolve } from "node:path";

export function getDataPath(): string {
  // Check for Docker environment
  const dockerPath = "/data/";
  if (existsSync(dockerPath)) {
    return resolve(dockerPath);
  }

  // Fall back to local path
  return resolve(process.cwd(), "data");
}

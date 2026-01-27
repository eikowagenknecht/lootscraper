import { readFile } from "node:fs/promises";

import { logger } from "./logger";
import { getPackageJsonPath } from "./path";

interface PackageJson {
  version: string;
  name: string;
}

export async function getPackageInfo(): Promise<PackageJson> {
  try {
    const packageJsonPath = getPackageJsonPath();
    const packageJson = await readFile(packageJsonPath, "utf8");
    return JSON.parse(packageJson) as PackageJson;
  } catch (error) {
    logger.error("Failed to read package.json", { error });
    return {
      version: "unknown",
      name: "lootscraper",
    };
  }
}

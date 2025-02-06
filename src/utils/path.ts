import { resolve } from "node:path";
import { logger } from "./logger";

/**
 * Get the path to the data directory.
 * In a Docker container, this is `/data`.
 * Otherwise, it is `./data`.
 *
 * @returns Path to the data directory
 */
export function getDataPath(): string {
  if (process.env.DOCKER_CONTAINER === "true") {
    logger.info("Running in Docker container, using /data for data storage");
    return "/data";
  }

  return resolve(process.cwd(), "data");
}

/**
 * Get the path to the templates directory.
 * In a Docker container, this is `/app/templates`.
 * Otherwise, it is `./templates`.
 *
 * @returns Path to the templates directory
 */
export function getTemplatesPath(): string {
  if (process.env.DOCKER_CONTAINER === "true") {
    return "/app/templates";
  }

  return resolve(process.cwd(), "templates");
}

import { basename, resolve } from "node:path";
import type { Config } from "@/types";
import { generateFileHash } from "@/utils/hash";
import { logger } from "@/utils/logger";
import { getDataPath } from "@/utils/path";
import { getAllEnabledFeedFilenames } from "@/utils/stringTools";
import { Client } from "basic-ftp";
import { DateTime } from "luxon";
import { createHash, getHashByResourceName } from "./database/hashRepository";

interface FTPUploadOptions {
  reuseConnection?: boolean;
  client?: Client;
}

type FTPUploadResult = {
  fileName: string;
} & (
  | {
      success: true;
    }
  | {
      success: false;
      error: string;
    }
);

class FTPService {
  private static instance: FTPService;
  private config: Config | null = null;

  private constructor() {
    // Private constructor to prevent instantiation
  }

  public static getInstance(): FTPService {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!FTPService.instance) {
      FTPService.instance = new FTPService();
    }
    return FTPService.instance;
  }

  public initialize(config: Config): void {
    this.config = config;
  }

  async uploadEnabledFeedsToServer(): Promise<void> {
    if (!this.config) {
      throw new Error("FTP service not initialized. Call initialize() first.");
    }

    try {
      const feedFiles = getAllEnabledFeedFilenames(
        this.config.common.feedFilePrefix,
      );
      await this.uploadMultipleFiles(feedFiles);
    } catch (error) {
      logger.error(
        `Failed to upload feeds: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async createFTPClient(): Promise<Client | undefined> {
    if (!this.config) {
      throw new Error("FTP service not initialized. Call initialize() first.");
    }

    if (!this.config.actions.uploadToFtp) {
      logger.info("FTP upload disabled.");
      return undefined;
    }

    if (
      !this.config.ftp.host ||
      !this.config.ftp.user ||
      !this.config.ftp.password
    ) {
      logger.error("FTP configuration missing.");
      return undefined;
    }

    const client = new Client();
    client.ftp.verbose = this.config.common.logLevel === "DEBUG";

    try {
      await client.access({
        host: this.config.ftp.host,
        user: this.config.ftp.user,
        password: this.config.ftp.password,
        secure: true,
        secureOptions: {
          checkServerIdentity: () => undefined,
        },
      });
      logger.debug(`Connected to FTP server ${this.config.ftp.host}`);
      return client;
    } catch (err) {
      logger.error(
        `Failed to connect to FTP server: ${err instanceof Error ? err.message : String(err)}`,
      );
      logger.debug("Closing FTP client");
      client.close();
      return undefined;
    }
  }

  async uploadFile(
    file: string,
    options: FTPUploadOptions = {},
  ): Promise<FTPUploadResult> {
    const fileName = basename(file);

    logger.verbose(`Uploading ${fileName}.`);

    if (!options.client && !options.reuseConnection) {
      const client = await this.createFTPClient();
      if (!client) {
        return {
          fileName,
          success: false,
          error: "Failed to create FTP client",
        };
      }
      options.client = client;
    }

    const client = options.client;
    if (!client) {
      return {
        fileName,
        success: false,
        error: "No FTP client provided",
      };
    }

    try {
      const absolutePath = resolve(getDataPath(), file);

      const hash = await generateFileHash(absolutePath);
      const existingHash = await getHashByResourceName(file);

      if (existingHash && existingHash.hash_value === hash) {
        logger.verbose(`File ${fileName} already up to date, skipping upload.`);
        return {
          fileName,
          success: true,
        };
      }

      await createHash({
        resource_name: file,
        hash_value: hash,
        last_updated: DateTime.now().toISO(),
      });

      await client.uploadFrom(absolutePath, fileName);
      logger.verbose(`Uploaded ${fileName}.`);
      return {
        fileName,
        success: true,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to upload ${fileName}: ${errorMessage}.`);
      return {
        fileName,
        success: false,
        error: errorMessage,
      };
    } finally {
      if (!options.reuseConnection) {
        logger.debug("Closing FTP client because reuseConnection is false.");
        client.close();
      }
    }
  }

  async uploadMultipleFiles(files: string[]): Promise<FTPUploadResult[]> {
    if (files.length === 0) {
      return [];
    }

    logger.info(`Batch uploading ${files.length.toFixed(0)} files.`);

    const client = await this.createFTPClient();
    if (!client) {
      return files.map((file) => ({
        success: false,
        fileName: basename(file),
        error: "Failed to create FTP client",
      }));
    }

    try {
      const results: FTPUploadResult[] = [];
      for (const file of files) {
        const result = await this.uploadFile(file, {
          client,
          reuseConnection: true,
        });
        results.push(result);
      }
      return results;
    } finally {
      client.close();
    }
  }
}

export const ftpService = FTPService.getInstance();

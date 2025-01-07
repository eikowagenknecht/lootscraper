import { basename, resolve } from "node:path";
import { config } from "@/services/config";
import { logger } from "@/utils/logger";
import { getDataPath } from "@/utils/path";
import { Client } from "basic-ftp";

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

async function createFTPClient(): Promise<Client | undefined> {
  logger.debug("Creating FTP client");
  const cfg = config.get();

  if (!cfg.actions.uploadToFtp) {
    logger.info("FTP upload disabled.");
    return undefined;
  }

  if (!cfg.ftp.host || !cfg.ftp.user || !cfg.ftp.password) {
    logger.error("FTP configuration missing.");
    return undefined;
  }

  const client = new Client();
  client.ftp.verbose = cfg.common.logLevel === "DEBUG";

  try {
    await client.access({
      host: cfg.ftp.host,
      user: cfg.ftp.user,
      password: cfg.ftp.password,
      secure: true,
      secureOptions: {
        checkServerIdentity: () => undefined,
      },
    });
    logger.debug(`Connected to FTP server ${cfg.ftp.host}`);
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

export async function uploadFile(
  file: string,
  options: FTPUploadOptions = {},
): Promise<FTPUploadResult> {
  const fileName = basename(file);

  logger.debug(`Start UploadFile ${fileName}`);

  if (!options.client && !options.reuseConnection) {
    const client = await createFTPClient();
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
    logger.debug(`Uploading ${fileName}`);
    await client.uploadFrom(absolutePath, fileName);
    logger.debug(`Uploaded ${fileName}`);
    return {
      fileName,
      success: true,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to upload ${fileName}: ${errorMessage}`);
    return {
      fileName,
      success: false,
      error: errorMessage,
    };
  } finally {
    if (!options.reuseConnection) {
      logger.debug("Closing FTP client because reuseConnection is false");
      client.close();
    }
  }
}

export async function uploadMultipleFiles(
  files: string[],
): Promise<FTPUploadResult[]> {
  if (files.length === 0) {
    return [];
  }

  const client = await createFTPClient();
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
      const result = await uploadFile(file, { client, reuseConnection: true });
      results.push(result);
    }
    return results;
  } finally {
    client.close();
    logger.info(`Completed upload batch of ${files.length.toFixed(0)} files`);
  }
}

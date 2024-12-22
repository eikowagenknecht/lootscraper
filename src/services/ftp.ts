import { basename } from "node:path";
import { config } from "@/services/config";
import { logger } from "@/utils/logger";
import FTPClient from "basic-ftp";

export async function uploadToServer(file: string): Promise<void> {
  const cfg = config.get();

  if (!cfg.actions.uploadToFtp) {
    logger.info("FTP upload disabled, skipping");
    return;
  }

  if (!cfg.ftp.host || !cfg.ftp.user || !cfg.ftp.password) {
    logger.error("FTP configuration missing");
    return;
  }

  const client = new FTPClient.Client();
  client.ftp.verbose = config.get().common.logLevel === "DEBUG";

  logger.debug("Connecting to FTP server");

  try {
    await client.access({
      host: cfg.ftp.host,
      user: cfg.ftp.user,
      password: cfg.ftp.password,
      secure: true, // Use explicit FTPS
    });

    const fileName = basename(file);
    logger.info(
      `Uploading ${fileName} to host ${cfg.ftp.host} as user ${cfg.ftp.user}`,
    );

    // Upload the file
    await client.uploadFrom(file, fileName);

    logger.debug("Finished uploading");
  } catch (err) {
    logger.error(
      `Failed to upload file: ${err instanceof Error ? err.message : String(err)}`,
    );
    throw err;
  } finally {
    client.close();
  }
}

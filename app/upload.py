from ftplib import FTP_TLS  # nosec
import logging
from pathlib import Path

from app.config.config import DATA_PATH, FEED_FILE, HOST, PASS, UPLOAD, USER


def upload_to_server() -> None:
    if UPLOAD is False:
        logging.info("Upload is disabled, skipping")
        return

    filename = Path(DATA_PATH) / Path(FEED_FILE)

    logging.info(f"Uploading {filename} to host {HOST} as user {USER}")
    with FTP_TLS(HOST) as session:
        session.auth()
        session.prot_p()
        session.login(USER, PASS)

        with open(filename, "rb") as file:
            session.storbinary("STOR " + FEED_FILE, file)

    logging.info("Finished uploading")

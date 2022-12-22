import logging
from ftplib import FTP_TLS  # nosec
from pathlib import Path

from lootscraper.config import Config

logger = logging.getLogger(__name__)


# TODO: This could be made async by switching to aioftp.
# Unfortunately, the current version of aioftp does not support
# TLS explicit encryption. For now it's run in a separate thread.
def upload_to_server(file: Path) -> None:
    host = Config.get().ftp_host
    user = Config.get().ftp_user
    password = Config.get().ftp_password

    logger.info(f"Uploading {file.name} to host {host} as user {user}")
    with FTP_TLS(host) as session:
        session.auth()
        session.prot_p()
        session.login(user, password)

        with open(file, "rb") as binary_file:
            session.storbinary("STOR " + file.name, binary_file)

    logger.debug("Finished uploading")

import logging
from ftplib import FTP_TLS  # nosec
from pathlib import Path

from app.configparser import Config

logger = logging.getLogger(__name__)


def upload_to_server(file: Path) -> None:
    host = Config.get().ftp_host
    user = Config.get().ftp_username
    password = Config.get().ftp_password

    logger.info(f"Uploading {file.name} to host {host} as user {user}")
    with FTP_TLS(host) as session:
        session.auth()
        session.prot_p()
        session.login(user, password)

        with open(file, "rb") as binary_file:
            session.storbinary("STOR " + file.name, binary_file)

    logger.debug("Finished uploading")

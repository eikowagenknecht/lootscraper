import logging
from ftplib import FTP_TLS  # nosec
from pathlib import Path

from app.configparser import Config


def upload_to_server(file: Path) -> None:
    host = Config.config()["upload"]["Host"]
    user = Config.config()["upload"]["User"]
    password = Config.config()["upload"]["Password"]

    logging.info(f"Uploading {file.name} to host {host} as user {user}")
    with FTP_TLS(host) as session:
        session.auth()
        session.prot_p()
        session.login(user, password)

        with open(file, "rb") as binary_file:
            session.storbinary("STOR " + file.name, binary_file)

    logging.info("Finished uploading")

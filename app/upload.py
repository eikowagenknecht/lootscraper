import logging
from ftplib import FTP_TLS  # nosec
from pathlib import Path

from app.configparser import Config


def upload_to_server() -> None:
    host = Config.config()["upload"]["Host"]
    user = Config.config()["upload"]["User"]
    password = Config.config()["upload"]["Password"]

    feed_file = Config.config()["common"]["FeedFile"]
    filename = Config.data_path() / Path(feed_file)

    logging.info(f"Uploading {filename} to host {host} as user {user}")
    with FTP_TLS(host) as session:
        session.auth()
        session.prot_p()
        session.login(user, password)

        with open(filename, "rb") as file:
            session.storbinary("STOR " + feed_file, file)

    logging.info("Finished uploading")

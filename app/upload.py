from ftplib import FTP_TLS  # nosec
from pathlib import Path

from app.common import FEED_FILE
from app.config.upload import HOST, PASS, UPLOAD, USER


def upload_to_server(path: Path = None) -> None:
    if UPLOAD is False:
        return

    if path is not None:
        filename = path / Path(FEED_FILE)
    else:
        filename = Path("data") / Path(FEED_FILE)

    with FTP_TLS(HOST) as session:
        session.auth()
        session.prot_p()
        session.login(USER, PASS)

        with open(filename, "rb") as file:
            session.storbinary("STOR gameloot.xml", file)

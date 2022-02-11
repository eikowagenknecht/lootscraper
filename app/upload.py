from ftplib import FTP_TLS  # nosec
from pathlib import Path

from app.config import HOST, PASS, UPLOAD, USER


def upload_to_server(path: Path = None) -> None:
    if UPLOAD is False:
        return

    if path is not None:
        filename = path / Path("gameloot.xml")
    else:
        filename = Path("data") / Path("gameloot.xml")

    with FTP_TLS(HOST) as session:
        session.auth()
        session.prot_p()
        session.login(USER, PASS)

        with open(filename, "rb") as file:
            session.storbinary("STOR gameloot.xml", file)

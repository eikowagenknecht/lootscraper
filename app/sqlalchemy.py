from __future__ import annotations

from pathlib import Path
from types import TracebackType
from typing import Any, Type

# from sqlalchemy.orm import relationship
# from sqlalchemy import insert
# from sqlalchemy.future.engine import Connection
from sqlalchemy import create_engine  # , text
from sqlalchemy import Column, Integer, MetaData, String, select  # , Table

# from sqlalchemy import and_, or_
# from sqlalchemy import ForeignKey
from sqlalchemy.orm import Session, registry

from app.configparser import Config

mapper_registry = registry()
Base = mapper_registry.generate_base()  # type: Any


class OldDbLoot(Base):
    __tablename__ = "loot"
    id = Column(Integer, primary_key=True)
    seen_first = Column(String)
    seen_last = Column(String)
    source = Column(String)
    type = Column(String)
    rawtext = Column(String)
    title = Column(String)
    subtitle = Column(String)
    publisher = Column(String)
    valid_from = Column(String)
    valid_to = Column(String)
    url = Column(String)
    img_url = Column(String)
    gameinfo = Column(String)

    def __repr__(self) -> str:
        return (
            "OldLoot("
            f"id={self.id!r}, "
            f"seen_first={self.seen_first!r}, "
            f"seen_last={self.seen_last!r}, "
            f"source={self.source!r}, "
            f"type={self.type!r}, "
            f"rawtext={self.rawtext!r}, "
            f"title={self.title!r}, "
            f"subtitle={self.subtitle!r}, "
            f"publisher={self.publisher!r}, "
            f"valid_from={self.valid_from!r}, "
            f"valid_to={self.valid_to!r}, "
            f"url={self.url!r}, "
            f"img_url={self.img_url!r}, "
            f"gameinfo={self.gameinfo!r}"
            f""
        )


class OldLootDatabase:
    def __init__(self) -> None:
        db_file_path = Config.data_path() / Path(Config.get().database_file)

        self.engine = create_engine(
            f"sqlite+pysqlite:///{db_file_path}",
            echo=True,
            future=True,
        )

        self.session = Session(self.engine)

    def __enter__(self) -> OldLootDatabase:
        return self

    def __exit__(
        self,
        exc_type: Type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        if isinstance(exc_value, Exception):
            self.session.rollback()
        else:
            self.session.commit()
        self.session.close()
        pass

    def initialize_or_update(self) -> None:
        metadata = MetaData()
        metadata.reflect(bind=self.engine)

        if "loot" not in metadata.tables:
            metadata.create_all()

    def read_all(self) -> list[OldDbLoot]:
        result = self.session.execute(select(OldDbLoot)).scalars().all()
        return result

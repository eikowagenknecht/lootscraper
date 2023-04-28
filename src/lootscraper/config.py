import contextlib
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path

import tomllib

from lootscraper.common import OfferDuration, OfferType, Source

# Do not use logging here. This is executed before the logging framework is
# initialized and using logging here would initialize with the wrong values.

CONFIG_FILE = Path("config.toml")


class TelegramLogLevel(Enum):
    DISABLED = 0
    ERROR = 1
    WARNING = 2
    INFO = 3
    DEBUG = 4


@dataclass
class ParsedConfig:
    # Common
    database_file: str = "loot.db"
    feed_file_prefix: str = "lootscraper"
    log_file: str = "lootscraper.log"
    log_level: str = "INFO"
    wait_between_runs_seconds: int = 0

    # Expert
    db_echo: bool = False
    web_timeout_seconds: int = 5

    # Sources: Offers
    enabled_offer_sources: list[Source] = field(default_factory=list)
    enabled_offer_types: list[OfferType] = field(default_factory=list)
    enabled_offer_durations: list[OfferDuration] = field(default_factory=list)

    # Sources: Info
    info_steam: bool = False
    info_igdb: bool = False

    # Actions
    scrape_info: bool = True
    generate_feed: bool = False
    upload_to_ftp: bool = False
    telegram_bot: bool = False

    # Telegram
    telegram_log_level: TelegramLogLevel = TelegramLogLevel.ERROR
    telegram_access_token: str = ""
    telegram_developer_chat_id: int = 0
    telegram_admin_user_id: int = 0

    # IGDB
    igdb_client_id: str = ""
    igdb_client_secret: str = ""

    # FTP
    ftp_host: str = ""
    ftp_user: str = ""
    ftp_password: str = ""

    # Feed
    feed_author_name: str = "John Doe"
    feed_author_email: str = "mail@example.com"
    feed_author_web: str = "https://example.com"
    feed_url_prefix: str = "https://feed.example.com/"
    feed_url_alternate: str = "https://example.com/loot"
    feed_id_prefix: str = "https://example.com/loot/"


class Config:
    __data_path = None
    __config_file = None
    __parsed_config: None | ParsedConfig = None

    @staticmethod
    def config_file() -> Path:
        """
        Return the path to the config file.
        """

        if Config.__config_file is None:
            data_path = Config.data_path()
            config_file = data_path / Path(CONFIG_FILE)
            Config.__config_file = config_file

        return Config.__config_file

    @staticmethod
    def data_path() -> Path:
        """
        Return the path to the data directory.
        """

        if Config.__data_path is None:
            docker_path = Path("/data")
            local_path = Path("data")
            if docker_path.exists():
                Config.__data_path = docker_path
            else:
                Config.__data_path = local_path

        return Config.__data_path

    @staticmethod
    def get() -> ParsedConfig:
        """
        Parse the config file into a ParsedConfig dataclass. Do this only once (lazy).
        """

        if Config.__parsed_config is None:
            with open(Config.data_path() / CONFIG_FILE, "rb") as f:
                data = tomllib.load(f)

            parsed_config = ParsedConfig()

            # Common
            with contextlib.suppress(KeyError):
                parsed_config.database_file = data["common"]["database_file"]

            with contextlib.suppress(KeyError):
                parsed_config.feed_file_prefix = data["common"]["feed_file_prefix"]

            with contextlib.suppress(KeyError):
                parsed_config.log_file = data["common"]["log_file"]

            with contextlib.suppress(KeyError):
                parsed_config.log_level = data["common"]["log_level"]

            with contextlib.suppress(KeyError):
                parsed_config.wait_between_runs_seconds = data["common"][
                    "wait_between_runs_seconds"
                ]

            # Expert
            with contextlib.suppress(KeyError):
                parsed_config.db_echo = data["expert"]["db_echo"]

            with contextlib.suppress(KeyError):
                parsed_config.web_timeout_seconds = data["expert"][
                    "web_timeout_seconds"
                ]

            # Scraper
            try:
                sources = data["scraper"]["offer_sources"]
                converted_sources = []
                for source in sources:
                    converted_sources.append(Source[source])
                parsed_config.enabled_offer_sources = converted_sources
            except KeyError:
                pass

            try:
                types = data["scraper"]["offer_types"]
                converted_types = []
                for type_ in types:
                    converted_types.append(OfferType[type_])
                parsed_config.enabled_offer_types = converted_types
            except KeyError:
                pass

            try:
                durations = data["scraper"]["offer_durations"]
                converted_durations = []
                for duration in durations:
                    converted_durations.append(OfferDuration[duration])
                parsed_config.enabled_offer_durations = converted_durations
            except KeyError:
                pass

            with contextlib.suppress(KeyError):
                parsed_config.info_steam = "STEAM" in data["scraper"]["info_sources"]

            with contextlib.suppress(KeyError):
                parsed_config.info_igdb = "IGDB" in data["scraper"]["info_sources"]

            # Actions
            with contextlib.suppress(KeyError):
                parsed_config.scrape_info = data["actions"]["scrape_info"]

            with contextlib.suppress(KeyError):
                parsed_config.generate_feed = data["actions"]["generate_feed"]

            with contextlib.suppress(KeyError):
                parsed_config.upload_to_ftp = data["actions"]["upload_to_ftp"]

            with contextlib.suppress(KeyError):
                parsed_config.telegram_bot = data["actions"]["telegram_bot"]

            # Telegram
            with contextlib.suppress(KeyError):
                parsed_config.telegram_access_token = data["telegram"]["access_token"]

            with contextlib.suppress(KeyError):
                parsed_config.telegram_developer_chat_id = data["telegram"][
                    "developer_chat_id"
                ]

            with contextlib.suppress(KeyError):
                parsed_config.telegram_log_level = TelegramLogLevel[
                    data["telegram"]["log_level"]
                ]

            with contextlib.suppress(KeyError):
                parsed_config.telegram_admin_user_id = data["telegram"]["admin_user_id"]

            # IGDB
            with contextlib.suppress(KeyError):
                parsed_config.igdb_client_id = data["igdb"]["client_id"]

            with contextlib.suppress(KeyError):
                parsed_config.igdb_client_secret = data["igdb"]["client_secret"]

            # FTP
            with contextlib.suppress(KeyError):
                parsed_config.ftp_host = data["ftp"]["host"]

            with contextlib.suppress(KeyError):
                parsed_config.ftp_user = data["ftp"]["user"]

            with contextlib.suppress(KeyError):
                parsed_config.ftp_password = data["ftp"]["password"]

            # Feed
            with contextlib.suppress(KeyError):
                parsed_config.feed_author_name = data["feed"]["author_name"]

            with contextlib.suppress(KeyError):
                parsed_config.feed_author_email = data["feed"]["author_email"]

            with contextlib.suppress(KeyError):
                parsed_config.feed_author_web = data["feed"]["author_web"]

            with contextlib.suppress(KeyError):
                parsed_config.feed_url_prefix = data["feed"]["url_prefix"]

            with contextlib.suppress(KeyError):
                parsed_config.feed_url_alternate = data["feed"]["url_alternate"]

            with contextlib.suppress(KeyError):
                parsed_config.feed_id_prefix = data["feed"]["id_prefix"]

            Config.__parsed_config = parsed_config

        return Config.__parsed_config

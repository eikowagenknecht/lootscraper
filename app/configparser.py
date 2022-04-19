import configparser
from dataclasses import dataclass
from pathlib import Path

CONFIG_FILE = Path("config.ini")

# Do not use logging here. This is executed before the logging framework is
# initialized and using logging here would initialize with the wrong values.


@dataclass
class ParsedConfig:
    # Common
    database_file: str = "loot.db"
    feed_file_prefix: str = "lootscraper"
    log_file: str = "lootscraper.log"
    log_level: str = "INFO"
    wait_between_runs: int = 0

    # Expert
    force_update: bool = False
    db_echo: bool = False

    # Sources: Offers
    offers_amazon: bool = True
    offers_epic: bool = True
    offers_steam: bool = True
    offers_gog: bool = True

    # Sources: Info
    info_steam: bool = True
    info_igdb: bool = True

    # Actions
    scrape_games: bool = True
    scrape_loot: bool = True
    scrape_info: bool = True  # Not used anywhere yet
    generate_feed: bool = True
    upload_feed: bool = False

    # Telegram
    telegram_access_token: str = ""
    telegram_developer_chat_id: int = 0

    # IGDB
    igdb_client_id: str = ""
    igdb_client_secret: str = ""

    # FTP
    ftp_host: str = ""
    ftp_username: str = ""
    ftp_password: str = ""

    # Feed
    feed_author_name: str = "Eiko Wagenknecht"
    feed_author_mail: str = "feed@ew-mail.de"
    feed_author_web: str = "https://eiko-wagenknecht.de"
    feed_url_prefix: str = "https://feed.phenx.de/"
    feed_url_alternate: str = "https://phenx.de/loot"
    feed_id_prefix: str = "https://phenx.de/loot/"


class Config:
    __data_path = None
    __config_file = None
    __parsed_config: None | ParsedConfig = None

    @staticmethod
    def config_file() -> Path:
        """Return the path to the config file."""
        if Config.__config_file is None:
            data_path = Config.data_path()
            config_file = data_path / Path(CONFIG_FILE)
            Config.__config_file = config_file

        return Config.__config_file

    @staticmethod
    def data_path() -> Path:
        """Return the path to the data directory."""
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
        """Parse the config file into a ParsedConfig dataclass. Do this only once (lazy)."""
        if Config.__parsed_config is None:
            config = configparser.ConfigParser()
            config.read(Config.data_path() / CONFIG_FILE)

            parsed_config = ParsedConfig()
            parsed_config.database_file = config["common"]["DatabaseFile"]
            parsed_config.feed_file_prefix = config["common"]["FeedFilePrefix"]
            parsed_config.log_file = config["common"]["LogFile"]
            parsed_config.log_level = config["common"]["LogLevel"]
            parsed_config.wait_between_runs = int(config["common"]["WaitBetweenRuns"])

            parsed_config.force_update = config.getboolean("expert", "ForceUpdate")
            parsed_config.db_echo = config.getboolean("expert", "DbEcho")

            parsed_config.offers_amazon = config.getboolean("sources_loot", "Amazon")
            parsed_config.offers_epic = config.getboolean("sources_loot", "Epic")
            parsed_config.offers_steam = config.getboolean("sources_loot", "Steam")
            parsed_config.offers_gog = config.getboolean("sources_loot", "GOG")

            parsed_config.info_steam = config.getboolean("sources_info", "Steam")
            parsed_config.info_igdb = config.getboolean("sources_info", "IGDB")

            parsed_config.scrape_games = config.getboolean("actions", "ScrapeGames")
            parsed_config.scrape_loot = config.getboolean("actions", "ScrapeLoot")
            parsed_config.scrape_info = config.getboolean("actions", "ScrapeInfo")
            parsed_config.generate_feed = config.getboolean("actions", "GenerateFeed")
            parsed_config.upload_feed = config.getboolean("actions", "UploadFtp")

            parsed_config.telegram_access_token = config["telegram"]["AccessToken"]
            parsed_config.telegram_developer_chat_id = int(
                config["telegram"]["DeveloperChatID"]
            )

            parsed_config.igdb_client_id = config["igdb"]["ClientID"]
            parsed_config.igdb_client_secret = config["igdb"]["ClientSecret"]

            parsed_config.ftp_host = config["ftp"]["Host"]
            parsed_config.ftp_username = config["ftp"]["User"]
            parsed_config.ftp_password = config["ftp"]["Password"]

            parsed_config.feed_author_name = config["feed"]["AuthorName"]
            parsed_config.feed_author_mail = config["feed"]["AuthorMail"]
            parsed_config.feed_author_web = config["feed"]["AuthorWeb"]
            parsed_config.feed_url_prefix = config["feed"]["FeedUrlPrefix"]
            parsed_config.feed_url_alternate = config["feed"]["FeedUrlAlternate"]
            parsed_config.feed_id_prefix = config["feed"]["FeedIdPrefix"]

            Config.__parsed_config = parsed_config

        return Config.__parsed_config

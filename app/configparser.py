import configparser
import logging
from pathlib import Path

CONFIG_FILE = Path("config.ini")


class Config:
    __conf = None
    __data_path = None
    __config_file = None

    @staticmethod
    def config_file() -> Path:
        if Config.__config_file is None:  # Read only once, lazy.
            data_path = Config.data_path()
            config_file = data_path / Path(CONFIG_FILE)
            Config.__config_file = config_file

            logging.info(f"Using config file: {Config.__config_file}")

        return Config.__config_file

    @staticmethod
    def data_path() -> Path:
        if Config.__data_path is None:  # Read only once, lazy.
            docker_path = Path("/data")
            local_path = Path("data")
            if docker_path.exists():
                Config.__data_path = docker_path
            else:
                Config.__data_path = local_path
            logging.info(f"Using data path: {Config.__data_path}")

        return Config.__data_path

    @staticmethod
    def config() -> configparser.ConfigParser:
        if Config.__conf is None:  # Read only once, lazy.
            Config.__conf = configparser.ConfigParser()
            Config.__conf.read(Config.data_path() / CONFIG_FILE)
        return Config.__conf

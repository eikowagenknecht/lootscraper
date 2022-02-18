# Copy this file to data/config.py and change the values there

import logging


HOST = "ftp.mypage.com"
USER = "username"
PASS = "12345678"  # nosec

UPLOAD = False

# Data path, relative to the script. For docker usage always /data
DATA_PATH = "/data"

DATABASE_FILE = "loot.db"
FEED_FILE = "gameloot.xml"
LOG_FILE = "lootscraper.log"

LOGLEVEL = logging.INFO

WAIT_BETWEEN_RUNS = 3600

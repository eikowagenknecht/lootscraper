import logging

import chromedriver_binary  # pylint: disable=unused-import # noqa: F401 # Imported for the sideeffects!
from selenium.webdriver import Chrome
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.webdriver import WebDriver

from app.config.config import CONTAINER_MODE

INJECTION_FILE = "js/inject.js"


def get_pagedriver() -> WebDriver:
    logging.info("Getting pagedriver options")
    options = Options()
    options.add_argument("--headless")
    options.add_argument(
        "--window-size=10000,10000"
    )  # To see everything. Default: 1920,1200
    options.add_argument("--lang=en-US")
    options.add_argument(
        "--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.39 Safari/537.36"
    )
    options.add_argument("--log-level=3")
    options.add_argument("--silent")

    if CONTAINER_MODE:
        logging.info("Adding Docker options")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")

    logging.info("Creating driver")
    driver = Chrome(options=options)

    logging.info("Injecting JS")
    with open(INJECTION_FILE, "r", encoding="utf-8") as file:
        js_to_inject = file.read()

    driver.execute_cdp_cmd(
        "Page.addScriptToEvaluateOnNewDocument",
        {"source": js_to_inject},  # type: ignore
    )  # type: ignore

    return driver

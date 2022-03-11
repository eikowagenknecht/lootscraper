import logging
from pathlib import Path

import chromedriver_binary  # pylint: disable=unused-import # noqa: F401 # Imported for the sideeffects!
from selenium.webdriver import Chrome
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.webdriver import WebDriver
from selenium_stealth import stealth

INJECTION_FILE = Path("js/inject.js")


def get_pagedriver() -> WebDriver:
    logging.info("Getting pagedriver options")
    options = Options()

    # ChromeDriver Fixes from https://stackoverflow.com/questions/48450594/selenium-timed-out-receiving-message-from-renderer
    # https://stackoverflow.com/a/26283818/1689770
    options.add_argument("start-maximized")
    # https://stackoverflow.com/a/43840128/1689770
    # options.add_argument("enable-automation")
    # only if you are ACTUALLY running headless
    #options.add_argument("--headless")
    # https://stackoverflow.com/a/50725918/1689770
    options.add_argument("--no-sandbox")
    # https://stackoverflow.com/a/43840128/1689770
    options.add_argument("--disable-infobars")
    # https://stackoverflow.com/a/50725918/1689770
    options.add_argument("--disable-dev-shm-usage")
    # https://stackoverflow.com/a/49123152/1689770
    options.add_argument("--disable-browser-side-navigation")
    # https://stackoverflow.com/questions/51959986/how-to-solve-selenium-chromedriver-timed-out-receiving-message-from-renderer-exc
    options.add_argument("--disable-gpu")

    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)

    # To see everything. Default: 1920,1200
    # options.add_argument("--window-size=10000,10000")
    # Scrape english version of page
    options.add_argument("--lang=en-US")
    # Loglevel
    options.add_argument("--log-level=3")
    options.add_argument("--silent")
    options.add_argument(
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36"
    )

    logging.info("Creating driver")
    driver = Chrome(options=options)

    stealth(
        driver,
        languages=["en-US", "en"],
        vendor="Google Inc.",
        platform="Win32",
        webgl_vendor="Intel Inc.",
        renderer="Intel Iris OpenGL Engine",
        fix_hairline=True,
    )

    # logging.info("Injecting JS")
    # with open(INJECTION_FILE, "r", encoding="utf-8") as file:
    # js_to_inject = file.read()

    # driver.execute_cdp_cmd(
    #        "Page.addScriptToEvaluateOnNewDocument",
    #        {"source": js_to_inject},  # type: ignore
    #    )  # type: ignore

    return driver

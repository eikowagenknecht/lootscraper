from selenium.webdriver import Chrome
from selenium.webdriver.chrome.webdriver import WebDriver
from selenium.webdriver.chrome.options import Options

import chromedriver_binary  # pylint: disable=unused-import # noqa: F401 # Imported for the sideeffects!

INJECTION_FILE = "js/inject.js"


def get_pagedriver(docker: bool) -> WebDriver:
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

    if docker:
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")

    driver = Chrome(options=options)

    # Inject JS
    with open(INJECTION_FILE, "r", encoding="utf-8") as file:
        js_to_inject = file.read()

    driver.execute_cdp_cmd(
        "Page.addScriptToEvaluateOnNewDocument", {"source": js_to_inject}
    )  # type: ignore

    return driver

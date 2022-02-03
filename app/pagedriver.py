from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service

INJECTION_FILE = "js/inject.js"
DRIVER_PATH = R"C:\Entwicklung\tools\Chromedriver\chromedriver.exe"


def get_pagedriver(docker: bool) -> webdriver.chrome.webdriver.WebDriver:
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
        driver = webdriver.Chrome(options=options)
    else:
        serv = Service(DRIVER_PATH)
        driver = webdriver.Chrome(options=options, service=serv)

    # Inject JS
    with open(INJECTION_FILE, "r", encoding="utf-8") as file:
        js_to_inject = file.read()

    driver.execute_cdp_cmd(
        "Page.addScriptToEvaluateOnNewDocument", {"source": js_to_inject}
    )

    return driver

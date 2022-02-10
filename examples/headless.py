import chromedriver_binary  # pylint: disable=unused-import # noqa: F401 # Imported for the sideeffects!
from selenium.webdriver import Chrome
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

INJECTION_FILE = "js/inject.js"

# Headless solution for *nix OS:
# https://stackoverflow.com/questions/45370018/selenium-working-with-chrome-but-not-headless-chrome?rq=1

# Headless Test
# https://intoli.com/blog/not-possible-to-block-chrome-headless/chrome-headless-test.html

# Headless Test umgehen (Teil 1 mit Selenium)
# https://intoli.com/blog/making-chrome-headless-undetectable/

# Headless Test umgehen (Teil 2 mit Puppeteer)
# https://intoli.com/blog/not-possible-to-block-chrome-headless/

USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.39 Safari/537.36"

options = Options()
options.add_argument("headless")
options.add_argument("window-size=1920,1200")
options.add_argument("lang=en-US")
options.add_argument("user-agent=" + USER_AGENT)

driver = Chrome(options=options)

with open(INJECTION_FILE, "r", encoding="utf-8") as file:
    js_to_inject = file.read()

driver.execute_cdp_cmd(
    "Page.addScriptToEvaluateOnNewDocument",
    {"source": js_to_inject},  # type: ignore
)  # type: ignore

driver.get(
    "https://intoli.com/blog/not-possible-to-block-chrome-headless/chrome-headless-test.html"
)
# driver.execute_async_script(INJECTED_JAVASCRIPT)

try:
    # Wait max. 10 seconds for the res to pop up
    WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.CLASS_NAME, "result"))
    )

    res: WebElement = driver.find_element(By.XPATH, "//table")
    res_str: str = res.text
    driver.save_screenshot("headless_results.png")
    print(res_str)
finally:
    # time.sleep(50)
    driver.quit()

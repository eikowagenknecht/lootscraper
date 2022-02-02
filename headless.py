from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Headless solution for *nix OS:
# https://stackoverflow.com/questions/45370018/selenium-working-with-chrome-but-not-headless-chrome?rq=1

# Headless Test
# https://intoli.com/blog/not-possible-to-block-chrome-headless/chrome-headless-test.html

# Headless Test umgehen (Teil 1 mit Selenium)
# https://intoli.com/blog/making-chrome-headless-undetectable/

# Headless Test umgehen (Teil 2 mit Puppeteer)
# https://intoli.com/blog/not-possible-to-block-chrome-headless/

DRIVER_PATH = R"C:\Entwicklung\chromedriver\chromedriver.exe"
USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.39 Safari/537.36"
with open("inject.js", "r", encoding="utf-8") as file:
    INJECTED_JAVASCRIPT = file.read()

options = Options()
options.add_argument("headless")
options.add_argument("window-size=1920,1200")
options.add_argument("lang=en-US")
options.add_argument("user-agent=" + USER_AGENT)

serv = Service(DRIVER_PATH)
driver = webdriver.Chrome(options=options, service=serv)
driver.execute_cdp_cmd(
    "Page.addScriptToEvaluateOnNewDocument", {"source": INJECTED_JAVASCRIPT}
)
driver.get(
    "https://intoli.com/blog/not-possible-to-block-chrome-headless/chrome-headless-test.html"
)
# driver.execute_async_script(INJECTED_JAVASCRIPT)

try:
    # Wait max. 10 seconds for the res to pop up
    element = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.CLASS_NAME, "result"))
    )

    res = driver.find_element(By.XPATH, "//table")
    driver.save_screenshot("headless_results.png")
    print(res.text)
finally:
    # time.sleep(50)
    driver.quit()

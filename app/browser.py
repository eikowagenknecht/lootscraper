import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

from playwright.async_api import Browser, BrowserContext, Page, async_playwright

from app.configparser import Config

logger = logging.getLogger(__name__)

INJECTION_FILE = Path("js/inject.js")


@asynccontextmanager
async def get_new_page(context: BrowserContext) -> AsyncGenerator[Page, None]:
    page = await context.new_page()
    try:
        yield page
    finally:
        await page.close()


@asynccontextmanager
async def get_browser_context() -> AsyncGenerator[BrowserContext, None]:
    logger.debug("Creating Playwright Chromium context")
    browser: Browser
    context: BrowserContext

    try:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(
                # Headful is needed for Epic Games
                headless=Config.get().headless_chrome,
                # Needed for docker
                chromium_sandbox=False,
            )
            context = await browser.new_context(
                # We want english pages
                locale="en-US",
                # Use Reykjavik timezone (=UTC) because UTC is not supported directly
                timezone_id="Atlantic/Reykjavik",
                # Seems not to be needed with PlayWright
                # user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.39 Safari/537.36"
            )
            context.set_default_timeout(Config.get().web_timeout * 1000)  # Milliseconds

            # TODO: Check if this is needed and comment, why if it is
            # with open(INJECTION_FILE, "r", encoding="utf-8") as file:
            #     js_to_inject = file.read()
            # await context.add_init_script(js_to_inject)

            # TODO: See which of these options (if any) are needed for playwright
            # # https://stackoverflow.com/a/50725918/1689770
            # # Must be first argument according to stack overflow
            # options.add_argument("--no-sandbox")
            # # ChromeDriver Fixes from https://stackoverflow.com/questions/48450594/selenium-timed-out-receiving-message-from-renderer
            # # https://stackoverflow.com/a/26283818/1689770
            # options.add_argument("start-maximized")
            # # https://stackoverflow.com/a/43840128/1689770
            # options.add_argument("enable-automation")
            # # https://stackoverflow.com/a/43840128/1689770
            # options.add_argument("--disable-infobars")
            # # https://stackoverflow.com/a/50725918/1689770
            # options.add_argument("--disable-dev-shm-usage")
            # # https://stackoverflow.com/a/49123152/1689770
            # options.add_argument("--disable-browser-side-navigation")
            # # https://stackoverflow.com/questions/51959986/how-to-solve-selenium-chromedriver-timed-out-receiving-message-from-renderer-exc
            # options.add_argument("--disable-gpu")
            # # To see everything, we use an extra long window. Default: 1920,1200
            # options.add_argument("--window-size=1920,1200")

            yield context
    finally:
        logging.debug("Closing Playwright Chromium context")

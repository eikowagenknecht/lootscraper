import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

from playwright.async_api import Browser, BrowserContext, Error, Page, async_playwright

from lootscraper.config import Config

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
    logger.debug("Creating Playwright Chromium context.")
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
            )
            context.set_default_timeout(Config.get().web_timeout * 1000)  # Milliseconds

            yield context
    except Error as e:
        logger.error(f"Error in Playwright Chromium context: {e}")
    finally:
        logger.debug("Closing Playwright Chromium context.")

"""
E2E tests for frontend: main page and login flow.
Run: pytest tests/e2e/test_frontend.py -v
Requires: pip install playwright && playwright install chromium
Server must be running: make run (or uvicorn)
"""
import pytest

try:
    from playwright.async_api import async_playwright
except ImportError:
    async_playwright = None

pytestmark = pytest.mark.skipif(async_playwright is None, reason="playwright not installed")


@pytest.fixture(scope="module")
def base_url():
    return "http://127.0.0.1:8000"


@pytest.mark.asyncio
async def test_main_page_loads(base_url):
    """Open main page; should redirect to login if not authenticated."""
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context()
        page = await context.new_page()
        try:
            await page.goto(base_url + "/", wait_until="domcontentloaded", timeout=10000)
            # Either we see login page (redirect) or schedule/empty state
            url = page.url
            content = await page.content()
            assert "login" in url or "МХТ" in content or "Расписание" in content
        finally:
            await browser.close()


@pytest.mark.asyncio
async def test_login_wrong_password_shows_error(base_url):
    """Login with wrong password should show error (toast or message)."""
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context()
        page = await context.new_page()
        try:
            await page.goto(base_url + "/login.html", wait_until="networkidle", timeout=10000)
            await page.fill("#telegram-id", "1214641616")
            await page.fill("#password", "wrongpass")
            await page.click("button[type=submit]")
            await page.wait_for_timeout(1500)
            # Toast or error message should appear
            toast = await page.locator(".toast, .toast-error, [role=alert]").first.is_visible()
            error_text = await page.locator("body").text_content()
            assert toast or "Ошибка" in error_text or "Неверный" in error_text or "попыток" in error_text
        finally:
            await browser.close()


@pytest.mark.asyncio
async def test_404_returns_custom_page(base_url):
    """Non-existent path should return 404 with custom page."""
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        try:
            resp = await page.goto(base_url + "/nonexistent-page-404", wait_until="commit")
            assert resp.status == 404
            content = await page.content()
            assert "404" in content or "не найдена" in content or "главную" in content
        finally:
            await browser.close()

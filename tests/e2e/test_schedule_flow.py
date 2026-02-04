"""
E2E tests with Playwright.
Run: E2E_ENABLED=1 pytest tests/e2e -v (with server running on BASE_URL, default http://localhost:8000)
Install browsers: playwright install
"""
import os
import pytest

pytestmark = pytest.mark.skipif(
    not os.getenv("E2E_ENABLED"),
    reason="E2E disabled. Set E2E_ENABLED=1 and run server to enable."
)

def test_login_page_renders(page, base_url):
    page.goto(f"{base_url}/login.html")
    page.wait_for_load_state("domcontentloaded")
    content = page.content()
    assert "Добро пожаловать" in content or "ID" in content or "login" in content.lower()

def test_main_page_redirects_to_login_without_auth(page, base_url):
    page.goto(f"{base_url}/")
    page.wait_for_load_state("domcontentloaded")
    assert "login" in page.url

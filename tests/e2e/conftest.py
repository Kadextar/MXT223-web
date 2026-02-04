import pytest
import os

def pytest_addoption(parser):
    parser.addoption("--base-url", default=os.getenv("BASE_URL", "http://localhost:8000"), help="Base URL for E2E tests")

@pytest.fixture(scope="session")
def base_url(pytestconfig):
    return pytestconfig.getoption("--base-url", default="http://localhost:8000")

import pytest
import pytest_asyncio
import os
import asyncio
from httpx import AsyncClient
from app.main import app
from app.database import database as app_database, init_db
from databases import Database

# Use a file-based SQLite db for tests to avoid concurrency issues with in-memory
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"

# Remove custom event_loop fixture to let pytest-asyncio handle it

@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_db():
    """Setup test database once for the session"""
    # Override global database with test database
    test_db = Database(TEST_DATABASE_URL)
    
    import app.database
    app.database.database = test_db
    
    # Run init_db to create tables
    await test_db.connect()
    
    # Clean previous run
    await test_db.execute("DROP TABLE IF EXISTS students")
    await test_db.execute("DROP TABLE IF EXISTS schedule")
    await test_db.execute("DROP TABLE IF EXISTS teachers")
    await test_db.execute("DROP TABLE IF EXISTS teacher_ratings")
    await test_db.execute("DROP TABLE IF EXISTS push_subscriptions")
    await test_db.execute("DROP TABLE IF EXISTS announcements")
    await test_db.execute("DROP TABLE IF EXISTS exams")
    
    await init_db()
    
    yield
    
    await test_db.disconnect()
    
    # Cleanup file
    if os.path.exists("./test.db"):
        os.remove("./test.db")

@pytest_asyncio.fixture
async def client():
    """Async client for tests"""
    # Create client
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

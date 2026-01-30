import pytest
from app.database import database

@pytest.mark.asyncio
async def test_login_success(client):
    # Determine the test user from seed data (init_db seeds 'test' user)
    # Using '1214641616' (Azamat) as seen in database.py
    
    response = await client.post("/api/login", json={
        "telegram_id": "1214641616",
        "password": "azamat2026"
    })
    
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "access_token" in data
    assert "user" in data
    assert data["user"]["telegram_id"] == "1214641616"

@pytest.mark.asyncio
async def test_login_invalid(client):
    response = await client.post("/api/login", json={
        "telegram_id": "1214641616",
        "password": "wrongpassword"
    })
    
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False

@pytest.mark.asyncio
async def test_me_endpoint(client):
    # 1. Login to get token
    login_res = await client.post("/api/login", json={
        "telegram_id": "1214641616",
        "password": "azamat2026"
    })
    token = login_res.json()["access_token"]
    
    # 2. Access /api/me
    response = await client.get("/api/me", headers={
        "Authorization": f"Bearer {token}"
    })
    
    assert response.status_code == 200
    data = response.json()
    assert data["telegram_id"] == "1214641616"
    assert "created_at" in data

@pytest.mark.asyncio
async def test_me_unauthorized(client):
    response = await client.get("/api/me")
    # Our dependency raises 403 or 401?
    # check dependencies.py: raises HTTPException(status_code=403, detail="Invalid token")
    # Actually wait, let's check dependencies.py
    assert response.status_code in [401, 403]

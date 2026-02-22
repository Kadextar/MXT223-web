import pytest


@pytest.mark.asyncio
async def test_health_live(client):
    """Liveness endpoint returns 200 without DB check."""
    response = await client.get("/health/live")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data
    assert "env" in data


@pytest.mark.asyncio
async def test_health_ok(client):
    """Readiness endpoint returns 200 and database connected when DB is up."""
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data.get("dependencies", {}).get("database") == "connected"
    assert "version" in data
    assert "env" in data

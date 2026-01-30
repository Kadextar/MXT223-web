import pytest

@pytest.mark.asyncio
async def test_get_schedule(client):
    response = await client.get("/api/schedule")
    assert response.status_code == 200
    data = response.json()
    
    assert isinstance(data, list)
    # Since we seeded data, there should be items
    assert len(data) > 0
    
    # Check structure
    item = data[0]
    expected_keys = {"id", "day", "pair", "subject", "teacher", "room"}
    
    for key in expected_keys:
        assert key in item

@pytest.mark.asyncio
async def test_schedule_filter(client):
    # This endpoint doesn't support filter params yet, but we can verify data content
    response = await client.get("/api/schedule")
    data = response.json()
    
    # Verify we have correct day names
    valid_days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    for item in data:
        assert item["day"] in valid_days

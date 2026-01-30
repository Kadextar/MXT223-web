from fastapi import APIRouter
from app.database import database
from utils.cache import cached

router = APIRouter()

# Helper function for cached schedule
@cached(ttl=300)  # 5 minutes cache
async def get_schedule_data():
    try:
        query = "SELECT * FROM schedule ORDER BY pair_number"
        rows = await database.fetch_all(query=query)
        print(f"🔍 get_schedule_data: Found {len(rows)} rows in DB")
        schedule = []
        for row in rows:
            schedule.append({
                "id": row["id"],
                "day": row["day_of_week"],
                "pair": row["pair_number"],
                "subject": row["subject"],
                "type": row["lesson_type"],
                "teacher": row["teacher"],
                "room": row["room"],
                "weeks": [row["week_start"], row["week_end"]]
            })
        return schedule
    except Exception as e:
        print(f"DB Error: {e}")
        return []

@router.get("/api/schedule")
async def get_schedule_cached():
    """Returns all lessons from database (currently NOCACHE as per recent fix)"""
    # TEMP: Disabled caching due to persistent stale cache issue
    # We are using the nocache logic directly here as per the fix applied in previous phase
    # But keeping the structure ready for when caching is re-enabled properly
    
    # Original cached intent:
    # return await get_schedule_data()
    
    # Current non-cached implementation:
    try:
        query = "SELECT * FROM schedule ORDER BY pair_number"
        rows = await database.fetch_all(query=query)
        print(f"🔍 get_schedule: Found {len(rows)} rows in DB")
        schedule = []
        for row in rows:
            schedule.append({
                "id": row["id"],
                "day": row["day_of_week"],
                "pair": row["pair_number"],
                "subject": row["subject"],
                "type": row["lesson_type"],
                "teacher": row["teacher"],
                "room": row["room"],
                "weeks": [row["week_start"], row["week_end"]]
            })
        return schedule
    except Exception as e:
        print(f"DB Error: {e}")
        return []

@router.get("/api/debug/schedule-nocache")
async def get_schedule_nocache():
    """Returns schedule WITHOUT caching - for debugging"""
    try:
        query = "SELECT * FROM schedule ORDER BY pair_number"
        rows = await database.fetch_all(query=query)
        print(f"🔍 NOCACHE: Found {len(rows)} rows in DB")
        schedule = []
        for row in rows:
            schedule.append({
                "id": row["id"],
                "day": row["day_of_week"],
                "pair": row["pair_number"],
                "subject": row["subject"],
                "type": row["lesson_type"],
                "teacher": row["teacher"],
                "room": row["room"],
                "weeks": [row["week_start"], row["week_end"]]
            })
        return schedule
    except Exception as e:
        print(f"❌ NOCACHE Error: {e}")
        return []

from fastapi import APIRouter, Query
from app.database import database
from app.logging_config import logger
from app.schemas import LessonItem, ScheduleResponse
from utils.cache import cached

router = APIRouter(tags=["Schedule"])

def _row_to_item(row):
    return {
        "id": row["id"],
        "day": row["day_of_week"],
        "pair": row["pair_number"],
        "subject": row["subject"],
        "type": row["lesson_type"],
        "teacher": row["teacher"],
        "room": row["room"],
        "weeks": [row["week_start"], row["week_end"]],
    }

@router.get(
    "/schedule",
    summary="Список занятий",
    description="С limit/offset — объект {items, total, limit, offset}. Без параметров — массив (обратная совместимость).",
)
async def get_schedule(
    limit: int = Query(None, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    try:
        query = "SELECT * FROM schedule ORDER BY pair_number"
        rows = await database.fetch_all(query=query)
        total = len(rows)
        if limit is not None:
            rows = rows[offset : offset + limit]
            items = [_row_to_item(row) for row in rows]
            return ScheduleResponse(items=items, total=total, limit=limit, offset=offset)
        # Backward compat: return plain array
        return [_row_to_item(row) for row in rows]
    except Exception:
        logger.exception("get_schedule DB error")
        return [] if limit is None else ScheduleResponse(items=[], total=0, limit=limit, offset=offset)

@router.get("/debug/schedule-nocache")
async def get_schedule_nocache():
    """Returns schedule WITHOUT caching - for debugging."""
    try:
        query = "SELECT * FROM schedule ORDER BY pair_number"
        rows = await database.fetch_all(query=query)
        return [_row_to_item(row) for row in rows]
    except Exception:
        logger.exception("schedule-nocache error")
        return []

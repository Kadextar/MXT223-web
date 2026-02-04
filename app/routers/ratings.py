from fastapi import APIRouter, Depends, HTTPException, Query
from app.database import database
from app.dependencies import get_current_user
from app.config import SEMESTER_START
from pydantic import BaseModel
from typing import List, Optional
from datetime import date

router = APIRouter(prefix="/api/ratings", tags=["Ratings"])


class RatingRequest(BaseModel):
    subject_name: str
    subject_type: str  # 'lecture' or 'seminar'
    rating: int  # 0-100
    tags: List[str] = []
    comment: Optional[str] = None
    date: str  # YYYY-MM-DD (frontend always отправляет сегодня)


def get_week_number(d: date) -> int:
    """Calculate academic week number from SEMESTER_START."""
    start = SEMESTER_START.date()
    if d < start:
        return 1
    diff_days = (d - start).days
    return diff_days // 7 + 1


@router.post("")
async def submit_rating(
    data: RatingRequest,
    user: dict = Depends(get_current_user),
):
    """
    Сохранить оценку за предмет.
    Ограничения:
    - Можно голосовать только за предметы, которые есть в расписании СЕГОДНЯ
    - Не чаще 1 раза в день на (предмет + тип) для конкретного студента
    """
    # Нормализуем дату и вычисляем текущую учебную неделю и день
    try:
        today = date.fromisoformat(data.date)
    except ValueError:
        today = date.today()

    week_num = get_week_number(today)
    weekday = today.weekday()  # Monday = 0
    if weekday > 4:
        # В выходные оценка не разрешена
        raise HTTPException(status_code=400, detail="Сегодня нет занятий для оценки")

    weekday_names = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    day_name = weekday_names[weekday]

    # Проверяем, что в расписании действительно есть такая пара сегодня
    check_query = """
        SELECT COUNT(*) AS cnt
        FROM schedule
        WHERE day_of_week = :day
          AND subject = :subject
          AND lesson_type = :type
          AND :week BETWEEN week_start AND week_end
    """
    cnt = await database.fetch_val(
        query=check_query,
        values={
            "day": day_name,
            "subject": data.subject_name,
            "type": data.subject_type,
            "week": week_num,
        },
    )

    if not cnt:
        raise HTTPException(
            status_code=400,
            detail="Сегодня этого занятия нет в расписании — оценка недоступна.",
        )

    student_id = user["telegram_id"]

    query = """
        INSERT INTO subject_ratings (subject_name, subject_type, rating, tags, comment, student_id, lesson_date)
        VALUES (:subject_name, :subject_type, :rating, :tags, :comment, :student_id, :lesson_date)
        ON CONFLICT(subject_name, subject_type, student_id, lesson_date) DO UPDATE SET
            rating = :rating,
            tags = :tags,
            comment = :comment
    """

    values = {
        "subject_name": data.subject_name,
        "subject_type": data.subject_type,
        "rating": data.rating,
        "tags": ",".join(data.tags),
        "comment": data.comment,
        "student_id": student_id,
        "lesson_date": today.isoformat(),
    }

    await database.execute(query=query, values=values)
    return {"status": "success", "message": "Rating saved"}

@router.get("/leaderboard")
async def get_leaderboard():
    """Топ предметов по средней оценке."""
    query = """
        SELECT 
            subject_name, 
            AVG(rating) as average, 
            COUNT(*) as count
        FROM subject_ratings
        GROUP BY subject_name
        HAVING count > 0
        ORDER BY average DESC
    """
    results = await database.fetch_all(query)

    return [
        {
            "subject": r["subject_name"],
            "average": int(r["average"]),
            "count": r["count"],
        }
        for r in results
    ]


@router.get("/comments")
async def get_comments(
    subject_name: str = Query(..., alias="subject_name"),
    subject_type: str = Query(..., alias="subject_type"),
):
    """Комментарии и оценки по предмету/типу (последние 20)."""
    query = """
        SELECT subject_name, subject_type, rating, tags, comment, lesson_date, created_at
        FROM subject_ratings
        WHERE subject_name = :name AND subject_type = :type
        ORDER BY created_at DESC
        LIMIT 20
    """
    rows = await database.fetch_all(query, values={"name": subject_name, "type": subject_type})

    result = []
    for r in rows:
        result.append(
            {
                "subject_name": r["subject_name"],
                "subject_type": r["subject_type"],
                "rating": r["rating"],
                "tags": (r["tags"] or "").split(",") if r["tags"] else [],
                "comment": r["comment"],
                "lesson_date": str(r["lesson_date"]),
                "created_at": str(r["created_at"]) if r["created_at"] else None,
            }
        )
    return result

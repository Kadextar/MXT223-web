from fastapi import APIRouter, Depends, HTTPException
from app.database import database
from app.dependencies import get_current_user
from app.config import SEMESTER_START
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

router = APIRouter(prefix="/ratings", tags=["Ratings"])

class RatingRequest(BaseModel):
    subject_name: str
    subject_type: str  # 'lecture' or 'seminar'
    rating: int  # 0-100
    tags: List[str] = []
    comment: Optional[str] = None
    date: str  # YYYY-MM-DD

@router.post("")
async def submit_rating(data: RatingRequest, user=Depends(get_current_user)):
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
        "tags": ",".join(data.tags) if data.tags else "",
        "comment": data.comment,
        "student_id": student_id,
        "lesson_date": data.date,
    }
    await database.execute(query=query, values=values)
    return {"status": "success", "message": "Rating saved"}


@router.get("/my")
async def get_my_ratings(user=Depends(get_current_user)):
    """List current user's ratings and weekly average for chart."""
    sid = user["telegram_id"]
    rows = await database.fetch_all(
        """SELECT subject_name, subject_type, rating, tags, comment, lesson_date, created_at
           FROM subject_ratings WHERE student_id = :sid ORDER BY lesson_date DESC, created_at DESC LIMIT 200""",
        {"sid": sid},
    )
    list_out = [
        {
            "subject_name": r["subject_name"],
            "subject_type": r["subject_type"],
            "rating": r["rating"],
            "tags": (r["tags"] or "").split(",") if r["tags"] else [],
            "comment": r["comment"],
            "lesson_date": str(r["lesson_date"]),
            "created_at": str(r["created_at"]),
        }
        for r in rows
    ]
    # By week (semester week): average rating per week for chart
    semester_start = SEMESTER_START.date() if hasattr(SEMESTER_START, "date") else SEMESTER_START
    week_avg = {}
    for r in rows:
        ld = r["lesson_date"]
        if hasattr(ld, "isoformat"):
            d = ld
        else:
            d = datetime.strptime(str(ld), "%Y-%m-%d").date()
        delta = (d - semester_start).days
        week_num = max(1, (delta // 7) + 1)
        if week_num not in week_avg:
            week_avg[week_num] = []
        week_avg[week_num].append(r["rating"])
    by_week = [
        {"week": w, "average": round(sum(week_avg[w]) / len(week_avg[w]), 1), "count": len(week_avg[w])}
        for w in sorted(week_avg.keys())
    ]
    return {"ratings": list_out, "by_week": by_week}

@router.get("/leaderboard")
async def get_leaderboard():
    # Only subjects with > 0 ratings
    query = """
        SELECT 
            subject_name, 
            AVG(rating) as average, 
            COUNT(*) as cnt
        FROM subject_ratings
        GROUP BY subject_name
        HAVING COUNT(*) > 0
        ORDER BY average DESC
    """
    results = await database.fetch_all(query)
    return [
        {"subject": r["subject_name"], "average": int(r["average"]), "count": r["cnt"]}
        for r in results
    ]


@router.get("/subject-summary")
async def get_subject_summary(subject: str = None):
    """Average rating, top tags, and recent reviews for a subject."""
    if not subject or not subject.strip():
        return {"average": None, "count": 0, "top_tags": [], "reviews": []}
    try:
        row = await database.fetch_one(
            """SELECT AVG(rating) as avg_r, COUNT(*) as cnt FROM subject_ratings WHERE subject_name = :s""",
            {"s": subject.strip()}
        )
        average = int(row["avg_r"]) if row and row["avg_r"] is not None else None
        count = row["cnt"] or 0

        tags_rows = await database.fetch_all(
            """SELECT tags FROM subject_ratings WHERE subject_name = :s AND tags IS NOT NULL AND tags != ''""",
            {"s": subject.strip()}
        )
        tag_counts = {}
        for r in tags_rows:
            for t in (r["tags"] or "").split(","):
                t = t.strip()
                if t:
                    tag_counts[t] = tag_counts.get(t, 0) + 1
        top_tags = sorted(tag_counts.keys(), key=lambda x: -tag_counts[x])[:5]

        reviews_rows = await database.fetch_all(
            """SELECT body, created_at FROM subject_reviews WHERE subject_name = :s AND moderated = TRUE ORDER BY created_at DESC LIMIT 3""",
            {"s": subject.strip()}
        )
        reviews = [{"body": r["body"], "created_at": str(r["created_at"])} for r in reviews_rows]

        return {"average": average, "count": count, "top_tags": top_tags, "reviews": reviews}
    except Exception:
        return {"average": None, "count": 0, "top_tags": [], "reviews": []}

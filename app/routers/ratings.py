from fastapi import APIRouter, Depends, HTTPException, Body
from app.database import database
from pydantic import BaseModel
from typing import List, Optional
from datetime import date, datetime

router = APIRouter(prefix="/api/ratings", tags=["Ratings"])

class RatingRequest(BaseModel):
    subject_name: str
    subject_type: str  # 'lecture' or 'seminar'
    rating: int  # 0-100
    tags: List[str] = []
    comment: Optional[str] = None
    date: str  # YYYY-MM-DD

@router.post("")
async def submit_rating(
    data: RatingRequest,
    # In a real app, use Depends(get_current_user) to get student_id
    # For now, we'll simulate or require it in headers if not fully implemented
    student_id: str = "anonymous_user" 
):
    # Validate logic (e.g. check duplicate) handled by DB constraints
    
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
        "student_id": student_id, # This should come from auth token
        "lesson_date": data.date
    }
    
    await database.execute(query=query, values=values)
    return {"status": "success", "message": "Rating saved"}

@router.get("/leaderboard")
async def get_leaderboard():
    # Only subjects with > 0 ratings
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
            "count": r["count"]
        } 
        for r in results
    ]

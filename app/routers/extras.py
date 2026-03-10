"""Extras: visitors, polls, announcement comments, materials, achievements."""
import json
from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel

from app.database import database
from app.logging_config import logger
from app.sanitize import sanitize_text

from app.models import DailyStatusCreate

router = APIRouter(tags=["Extras"])

# ----- Social Status (Moods) -----
@router.get("/status")
async def get_daily_statuses():
    """Get all statuses for today."""
    today = date.today().isoformat()
    # Join with students to get names and avatars
    query = """
        SELECT d.student_id, d.emoji, d.status_text, s.name, s.avatar 
        FROM daily_statuses d
        JOIN students s ON d.student_id = s.telegram_id
        WHERE d.status_date = :today
        ORDER BY d.created_at DESC
    """
    rows = await database.fetch_all(query, {"today": today})
    return [dict(r) for r in rows]

@router.post("/status")
async def post_daily_status(
    body: DailyStatusCreate,
    authorization: str = Header(None),
):
    """Post or update a status for today."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Unauthorized")
    from utils.jwt import verify_token, is_jwt_token
    token = authorization.replace("Bearer ", "")
    user_id = None
    if is_jwt_token(token):
        payload = verify_token(token, "access")
        if payload:
            user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    today = date.today().isoformat()
    text = sanitize_text(body.status_text, max_length=100) if body.status_text else None
    
    # Upsert logic
    try:
        await database.execute(
            """
            INSERT INTO daily_statuses (student_id, emoji, status_text, status_date) 
            VALUES (:uid, :emoji, :text, :today)
            ON CONFLICT(student_id, status_date) 
            DO UPDATE SET emoji = :emoji, status_text = :text, created_at = CURRENT_TIMESTAMP
            """,
            {"uid": user_id, "emoji": body.emoji, "text": text, "today": today}
        )
        return {"success": True}
    except Exception as e:
        logger.error(f"Error posting status: {e}")
        raise HTTPException(status_code=500, detail="Could not post status")


def _visitor_id(request: Request, auth_user_id: Optional[str]) -> str:
    if auth_user_id:
        return f"u:{auth_user_id}"
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return f"ip:{forwarded.split(',')[0].strip()}"
    return f"ip:{request.client.host if request.client else 'unknown'}"


# ----- Visitors (кто заходил сегодня) -----
@router.get("/stats/visitors")
async def get_visitors_today(
    request: Request,
    authorization: str = Header(None),
):
    """Record current visitor for today and return unique count. Call once per session."""
    user_id = None
    if authorization:
        from utils.jwt import verify_token, is_jwt_token
        token = (authorization or "").replace("Bearer ", "")
        if is_jwt_token(token):
            payload = verify_token(token, "access")
            if payload:
                user_id = payload.get("sub")
    vid = _visitor_id(request, user_id)
    today = date.today().isoformat()
    try:
        await database.execute(
            "INSERT INTO visitor_log (visit_date, visitor_identifier) VALUES (:d, :v)",
            {"d": today, "v": vid},
        )
    except Exception:
        pass  # already visited today
    try:
        r = await database.fetch_one(
            "SELECT COUNT(DISTINCT visitor_identifier) as c FROM visitor_log WHERE visit_date = :d",
            {"d": today},
        )
        count = r["c"] if r else 0
    except Exception:
        count = 0
    return {"visitors_today": count}


# ----- Polls -----
class PollCreate(BaseModel):
    question: str
    options: List[str]


class PollVote(BaseModel):
    option_index: int


@router.get("/polls")
async def list_polls():
    """List active polls."""
    rows = await database.fetch_all(
        "SELECT id, question, options_json, created_at FROM polls WHERE active = TRUE ORDER BY created_at DESC"
    )
    out = []
    for r in rows:
        try:
            opts = json.loads(r["options_json"]) if isinstance(r["options_json"], str) else r["options_json"]
        except Exception:
            opts = []
        out.append({"id": r["id"], "question": r["question"], "options": opts, "created_at": str(r["created_at"])})
    return out


@router.get("/polls/{poll_id}/results")
async def poll_results(poll_id: int):
    """Get vote counts per option for a poll."""
    poll = await database.fetch_one("SELECT id, question, options_json FROM polls WHERE id = :id", {"id": poll_id})
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found")
    opts = json.loads(poll["options_json"]) if isinstance(poll["options_json"], str) else poll["options_json"]
    votes = await database.fetch_all(
        "SELECT option_index FROM poll_votes WHERE poll_id = :id", {"id": poll_id}
    )
    counts = [0] * len(opts)
    for v in votes:
        i = v["option_index"]
        if 0 <= i < len(counts):
            counts[i] += 1
    return {"question": poll["question"], "options": opts, "counts": counts, "total": len(votes)}


@router.post("/polls/{poll_id}/vote")
async def vote_poll(
    poll_id: int,
    body: PollVote,
    request: Request,
    authorization: str = Header(None),
):
    """Vote for an option (one vote per user/identifier per poll)."""
    user_id = None
    if authorization:
        from utils.jwt import verify_token, is_jwt_token
        token = (authorization or "").replace("Bearer ", "")
        if is_jwt_token(token):
            payload = verify_token(token, "access")
            if payload:
                user_id = payload.get("sub")
    vid = _visitor_id(request, user_id)
    poll = await database.fetch_one("SELECT id, options_json FROM polls WHERE id = :id AND active = TRUE", {"id": poll_id})
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found")
    opts = json.loads(poll["options_json"]) if isinstance(poll["options_json"], str) else poll["options_json"]
    if not (0 <= body.option_index < len(opts)):
        raise HTTPException(status_code=400, detail="Invalid option")
    try:
        await database.execute(
            "INSERT INTO poll_votes (poll_id, user_identifier, option_index) VALUES (:pid, :uid, :opt)",
            {"pid": poll_id, "uid": vid, "opt": body.option_index},
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Already voted")
    return {"success": True}


# ----- Announcement comments -----
class CommentCreate(BaseModel):
    announcement_id: int
    body: str


@router.get("/announcement/{announcement_id}/comments")
async def get_announcement_comments(announcement_id: int):
    rows = await database.fetch_all(
        """SELECT id, user_identifier, body, created_at FROM announcement_comments
           WHERE announcement_id = :aid ORDER BY created_at ASC""",
        {"aid": announcement_id},
    )
    return [{"id": r["id"], "user_identifier": r["user_identifier"][:3] + "***", "body": r["body"], "created_at": str(r["created_at"])} for r in rows]


@router.post("/announcement/comments")
async def post_announcement_comment(
    body: CommentCreate,
    request: Request,
    authorization: str = Header(None),
):
    user_id = "anonymous"
    if authorization:
        from utils.jwt import verify_token, is_jwt_token
        token = (authorization or "").replace("Bearer ", "")
        if is_jwt_token(token):
            payload = verify_token(token, "access")
            if payload:
                user_id = payload.get("sub")
    text = sanitize_text(body.body, max_length=500)
    if not text:
        raise HTTPException(status_code=400, detail="Текст комментария обязателен")
    await database.execute(
        "INSERT INTO announcement_comments (announcement_id, user_identifier, body) VALUES (:aid, :uid, :body)",
        {"aid": body.announcement_id, "uid": user_id, "body": text},
    )
    return {"success": True}


# ----- Materials per subject -----
@router.get("/materials")
async def get_materials(subject: Optional[str] = None):
    """List materials; filter by subject if given."""
    if subject:
        rows = await database.fetch_all(
            "SELECT id, subject_name, title, url, created_at FROM subject_materials WHERE subject_name = :s ORDER BY created_at DESC",
            {"s": subject},
        )
    else:
        rows = await database.fetch_all(
            "SELECT id, subject_name, title, url, created_at FROM subject_materials ORDER BY created_at DESC"
        )
    return [dict(r) for r in rows]


# ----- Achievements -----
ACHIEVEMENTS_DEF = [
    {"key": "streak_7", "name": "Неделя подряд", "description": "Заходил 7 дней подряд", "icon": "🔥"},
    {"key": "ratings_5", "name": "Критик", "description": "Оценил 5 преподавателей", "icon": "⭐"},
    {"key": "notes_3", "name": "Заметки", "description": "Вёл заметки к 3 предметам", "icon": "📝"},
    {"key": "first_login", "name": "Первый вход", "description": "Вошел в приложение", "icon": "👋"},
]


@router.get("/achievements/me")
async def my_achievements(authorization: str = Header(None)):
    """Return achievements unlocked by current user."""
    user_id = None
    if authorization:
        from utils.jwt import verify_token, is_jwt_token
        token = (authorization or "").replace("Bearer ", "")
        if is_jwt_token(token):
            payload = verify_token(token, "access")
            if payload:
                user_id = payload.get("sub")
    if not user_id:
        return {"achievements": []}
    rows = await database.fetch_all(
        "SELECT achievement_key, unlocked_at FROM user_achievements WHERE user_identifier = :uid",
        {"uid": user_id},
    )
    unlocked = {r["achievement_key"]: r["unlocked_at"] for r in rows}
    out = []
    for a in ACHIEVEMENTS_DEF:
        t = unlocked.get(a["key"])
        out.append({**a, "unlocked_at": str(t) if t else None})
    return {"achievements": out}


async def _grant_achievement(user_id: str, key: str) -> bool:
    """Grant achievement if not already. Returns True if newly granted."""
    try:
        await database.execute(
            "INSERT INTO user_achievements (user_identifier, achievement_key) VALUES (:uid, :k)",
            {"uid": user_id, "k": key},
        )
        return True
    except Exception:
        return False

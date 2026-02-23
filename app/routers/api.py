from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Header, HTTPException, Response, Depends
from pydantic import BaseModel
from app.database import database
from app.config import SEMESTER_START, PAIR_TIMES, DAY_MAPPING, FEATURE_FLAGS, APP_VERSION
from app.logging_config import logger
from app.models import RateTeacherRequest, SubjectReviewCreate, AnnouncementReadRequest
from app.dependencies import get_current_user
from app.sanitize import sanitize_text
from utils.cache import cached

router = APIRouter(tags=["API"])


class DeadlineCreate(BaseModel):
    title: str
    due_date: str  # YYYY-MM-DD


@router.get("/deadlines")
async def get_deadlines(user=Depends(get_current_user)):
    """List current user's deadlines."""
    try:
        rows = await database.fetch_all(
            "SELECT id, title, due_date, created_at FROM user_deadlines WHERE student_id = :sid ORDER BY due_date ASC",
            {"sid": user["telegram_id"]}
        )
        return [{"id": r["id"], "title": r["title"], "due_date": str(r["due_date"]), "created_at": str(r["created_at"])} for r in rows]
    except Exception:
        return []


@router.post("/deadlines")
async def add_deadline(data: DeadlineCreate, user=Depends(get_current_user)):
    """Add a deadline for current user."""
    title = sanitize_text(data.title, max_length=200)
    if not title:
        raise HTTPException(status_code=400, detail="title required")
    try:
        await database.execute(
            "INSERT INTO user_deadlines (student_id, title, due_date) VALUES (:sid, :title, :due)",
            {"sid": user["telegram_id"], "title": title, "due": data.due_date}
        )
        row = await database.fetch_one("SELECT id, title, due_date FROM user_deadlines WHERE student_id = :sid ORDER BY id DESC LIMIT 1", {"sid": user["telegram_id"]})
        return {"success": True, "id": row["id"], "title": row["title"], "due_date": str(row["due_date"])}
    except Exception as e:
        logger.exception("deadline add")
        raise HTTPException(status_code=500, detail="Failed to add deadline")


@router.delete("/deadlines/{deadline_id}")
async def delete_deadline(deadline_id: int, user=Depends(get_current_user)):
    """Delete a deadline (only own)."""
    try:
        await database.execute(
            "DELETE FROM user_deadlines WHERE id = :id AND student_id = :sid",
            {"id": deadline_id, "sid": user["telegram_id"]}
        )
        return {"success": True}
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to delete")


class FavoritesUpdate(BaseModel):
    subjects: List[str]


@router.get("/favorites")
async def get_favorites(user=Depends(get_current_user)):
    """List current user's favorite subjects (synced across devices)."""
    try:
        rows = await database.fetch_all(
            "SELECT subject_name FROM user_favorites WHERE student_id = :sid ORDER BY subject_name",
            {"sid": user["telegram_id"]},
        )
        return {"subjects": [r["subject_name"] for r in rows]}
    except Exception:
        return {"subjects": []}


@router.put("/favorites")
async def set_favorites(data: FavoritesUpdate, user=Depends(get_current_user)):
    """Replace user's favorite subjects list."""
    sid = user["telegram_id"]
    await database.execute("DELETE FROM user_favorites WHERE student_id = :sid", {"sid": sid})
    for name in (data.subjects or [])[:100]:
        name = sanitize_text(name, max_length=200)
        if name:
            try:
                await database.execute(
                    "INSERT INTO user_favorites (student_id, subject_name) VALUES (:sid, :name)",
                    {"sid": sid, "name": name},
                )
            except Exception:
                pass
    return {"success": True, "subjects": data.subjects or []}


@router.get("/flags", summary="Feature flags и версия для фронта")
async def get_flags():
    """Return feature flags and app version for frontend."""
    return {**FEATURE_FLAGS, "version": APP_VERSION}


@router.get("/next", summary="Следующая пара (для бота и виджета)")
async def get_next_lesson():
    """Возвращает следующую пару по текущему времени (для API/бота)."""
    try:
        now = datetime.now()
        day_idx = now.weekday()  # 0 mon .. 6 sun
        if day_idx >= 5:
            return {"next": None, "message": "Выходной"}
        day_name = list(DAY_MAPPING.keys())[day_idx]
        delta = now.date() - SEMESTER_START.date()
        week_num = max(1, (delta.days // 7) + 1)
        rows = await database.fetch_all("SELECT * FROM schedule ORDER BY pair_number")
        times = PAIR_TIMES
        for row in rows:
            if row["day_of_week"] != day_name:
                continue
            if not (row["week_start"] <= week_num <= row["week_end"]):
                continue
            t = times.get(row["pair_number"])
            if not t:
                continue
            start_h, start_m = map(int, t[0].split(":"))
            lesson_date = SEMESTER_START + timedelta(weeks=week_num - 1, days=day_idx)
            dt_start = lesson_date.replace(hour=start_h, minute=start_m)
            if dt_start > now:
                return {
                    "next": {
                        "subject": row["subject"],
                        "room": row["room"],
                        "teacher": row["teacher"],
                        "pair": row["pair_number"],
                        "start": t[0],
                        "in_minutes": int((dt_start - now).total_seconds() / 60),
                    },
                }
        return {"next": None, "message": "Пар больше нет сегодня"}
    except Exception as e:
        logger.exception("get_next_lesson: %s", e)
        return {"next": None, "error": str(e)}


@router.post("/metrics", summary="Web Vitals / custom metrics (log only)")
async def post_metrics(data: dict):
    """Accept client metrics (e.g. LCP, FID, CLS) and log for monitoring."""
    logger.info("client_metrics %s", data)
    return Response(status_code=204)


@router.get("/subjects")
async def get_subjects():
    """Returns aggregated subjects information with caching"""
    # Simply using cache decorator on a helper or querying directly
    # For now, let's query directly as simple endpoints
    try:
        query = """
            SELECT DISTINCT subject, lesson_type, teacher, room 
            FROM schedule 
            ORDER BY subject
        """
        rows = await database.fetch_all(query=query)
        
        subjects = {}
        for row in rows:
            name = row["subject"]
            if name not in subjects:
                subjects[name] = {
                    "name": name,
                    "types": [],
                    "teachers": set(),
                    "rooms": set()
                }
            
            if row["lesson_type"] not in subjects[name]["types"]:
                subjects[name]["types"].append(row["lesson_type"])
            
            if row["teacher"] and row["teacher"] != "Не указан":
                subjects[name]["teachers"].add(row["teacher"])
                
            if row["room"] and "*" not in row["room"]:
                subjects[name]["rooms"].add(row["room"])
        
        # Convert sets to lists
        result = []
        for name, data in subjects.items():
            data["teachers"] = list(data["teachers"])
            data["rooms"] = list(data["rooms"])
            result.append(data)
            
        return result
    except Exception as e:
        logger.exception("Subjects error")
        return []

@router.get("/exams")
async def get_exams():
    """Get all exams"""
    try:
        query = "SELECT * FROM exams ORDER BY exam_date"
        rows = await database.fetch_all(query=query)
        return [
            {
                "id": r["id"],
                "subject": r["subject"],
                "teacher": r["teacher"] or "",
                "exam_date": str(r["exam_date"]) if r.get("exam_date") else "",
                "exam_time": r["exam_time"] or "",
                "room": r["room"] or "",
                "exam_type": r["exam_type"] or "",
                "notes": r["notes"] or "",
            }
            for r in rows
        ]
    except Exception as e:
        return []


@router.get("/exams/reminders")
async def get_exam_reminders(user=Depends(get_current_user)):
    """List exam ids the current user wants reminder for."""
    try:
        rows = await database.fetch_all(
            "SELECT exam_id FROM exam_reminders WHERE student_id = :sid",
            {"sid": user["telegram_id"]},
        )
        return {"exam_ids": [r["exam_id"] for r in rows]}
    except Exception:
        return {"exam_ids": []}


@router.post("/exams/{exam_id:int}/remind")
async def add_exam_reminder(exam_id: int, user=Depends(get_current_user)):
    """Subscribe to push reminder 1 day before this exam."""
    try:
        exam = await database.fetch_one("SELECT id FROM exams WHERE id = :eid", {"eid": exam_id})
        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found")
        existing = await database.fetch_one(
            "SELECT 1 FROM exam_reminders WHERE student_id = :sid AND exam_id = :eid",
            {"sid": user["telegram_id"], "eid": exam_id},
        )
        if not existing:
            await database.execute(
                "INSERT INTO exam_reminders (student_id, exam_id) VALUES (:sid, :eid)",
                {"sid": user["telegram_id"], "eid": exam_id},
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("add_exam_reminder")
        raise HTTPException(status_code=500, detail="Failed to add reminder")
    return {"success": True}


@router.delete("/exams/{exam_id:int}/remind")
async def remove_exam_reminder(exam_id: int, user=Depends(get_current_user)):
    """Unsubscribe from exam reminder."""
    try:
        await database.execute(
            "DELETE FROM exam_reminders WHERE student_id = :sid AND exam_id = :eid",
            {"sid": user["telegram_id"], "eid": exam_id},
        )
        return {"success": True}
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to remove reminder")


@router.get("/ratings")
async def get_ratings():
    """Get all teacher ratings"""
    try:
        # Get teachers with avg rating
        query_teachers = "SELECT * FROM teachers ORDER BY average_rating DESC"
        teachers = await database.fetch_all(query=query_teachers)
        
        result = []
        for t in teachers:
            # Get reviews for each teacher
            query_reviews = """
                SELECT * FROM teacher_ratings 
                WHERE teacher_id = :tid 
                ORDER BY created_at DESC 
                LIMIT 5
            """
            reviews = await database.fetch_all(query=query_reviews, values={"tid": t["id"]})
            
            result.append({
                "id": t["id"],
                "name": t["name"],
                "subject": t["subject"],
                "average_rating": t["average_rating"],
                "total_ratings": t["total_ratings"],
                "reviews": [dict(r) for r in reviews]
            })
            
        return result
    except Exception as e:
        logger.exception("Ratings error")
        return []

@router.post("/rate-teacher")
async def rate_teacher(data: RateTeacherRequest, authorization: str = Header(None)):
    """Submit a teacher rating"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Auth required")
    try:
        from utils.jwt import verify_token, is_jwt_token
        import hashlib

        token = authorization.replace("Bearer ", "")
        if is_jwt_token(token):
            payload = verify_token(token, "access")
            if not payload:
                raise HTTPException(status_code=401, detail="Invalid token")
            user_id = payload.get("sub")
        else:
            user_id = token

        user_hash = hashlib.sha256(user_id.encode()).hexdigest()
        teacher_id = data.teacher_id
        rating = data.rating
        tags = data.tags
        comment = sanitize_text(data.comment, max_length=1000)
            
        # Upsert rating
        # Check existing
        check = "SELECT id FROM teacher_ratings WHERE teacher_id = :tid AND student_hash = :hash"
        existing = await database.fetch_one(check, {"tid": teacher_id, "hash": user_hash})
        
        if existing:
            update = """
                UPDATE teacher_ratings 
                SET rating = :rating, tags = :tags, comment = :comment, updated_at = CURRENT_TIMESTAMP
                WHERE id = :id
            """
            await database.execute(update, {
                "rating": rating, "tags": str(tags), "comment": comment, "id": existing["id"]
            })
        else:
            insert = """
                INSERT INTO teacher_ratings (teacher_id, student_hash, rating, tags, comment)
                VALUES (:tid, :hash, :rating, :tags, :comment)
            """
            await database.execute(insert, {
                "tid": teacher_id, "hash": user_hash, "rating": rating, "tags": str(tags), "comment": comment
            })
            
        # Recalculate average
        avg_query = "SELECT AVG(rating) as avg, COUNT(*) as cnt FROM teacher_ratings WHERE teacher_id = :tid"
        stats = await database.fetch_one(avg_query, {"tid": teacher_id})
        
        update_teacher = "UPDATE teachers SET average_rating = :avg, total_ratings = :cnt WHERE id = :tid"
        await database.execute(update_teacher, {
            "avg": round(stats["avg"], 1), "cnt": stats["cnt"], "tid": teacher_id
        })
        logger.info("rating_submitted", extra={"teacher_id": teacher_id})
        try:
            from app.routers.extras import _grant_achievement
            if stats["cnt"] >= 5:
                await _grant_achievement(user_id, "ratings_5")
        except Exception:
            pass
        return {"success": True}
    except Exception as e:
        logger.exception("Rate error")
        return {"success": False, "error": str(e)}

@router.get("/subject-reviews")
async def get_subject_reviews(subject: str = None):
    """Anonymous short reviews for a subject (only moderated)."""
    if not subject:
        return []
    try:
        rows = await database.fetch_all(
            "SELECT id, subject_name, body, created_at FROM subject_reviews WHERE subject_name = :s AND moderated = TRUE ORDER BY created_at DESC LIMIT 5",
            values={"s": subject}
        )
        return [{"id": r["id"], "body": r["body"], "created_at": str(r["created_at"])} for r in rows]
    except Exception:
        return []


@router.post("/subject-reviews")
async def post_subject_review(data: SubjectReviewCreate):
    """Submit anonymous short review for a subject."""
    body = sanitize_text(data.body, max_length=500)
    subject = sanitize_text(data.subject_name, max_length=200)
    if not body or not subject:
        raise HTTPException(status_code=400, detail="body and subject_name required")
    await database.execute(
        "INSERT INTO subject_reviews (subject_name, body, moderated) VALUES (:s, :b, FALSE)",
        {"s": subject, "b": body}
    )
    return {"success": True}


@router.get("/announcement")
async def get_announcement():
    """Returns active announcement if exists"""
    try:
        query = "SELECT * FROM announcements WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 1"
        row = await database.fetch_one(query=query)
        if row:
            out = {"id": row["id"], "message": row["message"], "created_at": str(row["created_at"])}
            if row.get("schedule_context"):
                try:
                    import json
                    out["schedule_context"] = json.loads(row["schedule_context"])
                except Exception:
                    pass
            return out
        return None
    except Exception as e:
        logger.exception("Announcement DB error")
        return None


@router.post("/announcement/read")
async def mark_announcement_read(
    data: Optional[AnnouncementReadRequest] = None,
    authorization: str = Header(None),
):
    """Mark current announcement as read (for admin stats). Uses telegram_id if auth, else identifier from body."""
    try:
        row = await database.fetch_one("SELECT id FROM announcements WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 1")
        if not row:
            return Response(status_code=204)
        user_id = None
        if authorization:
            from utils.jwt import verify_token
            token = (authorization or "").replace("Bearer ", "")
            if token:
                payload = verify_token(token, "access")
                if payload:
                    user_id = payload.get("sub")
        if not user_id and data and data.identifier:
            user_id = data.identifier
        if not user_id:
            user_id = "anonymous"
        try:
            await database.execute(
                "INSERT INTO announcement_reads (announcement_id, user_identifier) VALUES (:aid, :uid)",
                {"aid": row["id"], "uid": user_id}
            )
        except Exception:
            pass
        return Response(status_code=204)
    except Exception as e:
        logger.exception("announcement read error")
        return Response(status_code=204)

@router.get("/calendar.ics")
async def get_calendar_ics():
    """Generate ICS file for subscription"""
    try:
        query = "SELECT * FROM schedule"
        lessons = await database.fetch_all(query=query)
        
        cal_content = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//MXT-223//Schedule//RU",
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH",
            "X-WR-CALNAME:Расписание МХТ-223",
            "X-WR-TIMEZONE:Asia/Tashkent",
        ]
        
        for lesson in lessons:
            week_start_num = lesson["week_start"]
            week_end_num = lesson["week_end"]
            day_idx = DAY_MAPPING.get(lesson["day_of_week"])
            
            if day_idx is None:
                continue
                
            times = PAIR_TIMES.get(lesson["pair_number"])
            if not times:
                continue
                
            # Iterate through all weeks for this lesson
            for week_num in range(week_start_num, week_end_num + 1):
                # Calculate actual date
                # Week 1 starts at SEMESTER_START
                # Add (week_num - 1) weeks
                # Add day_idx days
                
                lesson_date = SEMESTER_START + timedelta(weeks=week_num-1, days=day_idx)
                
                # Combine with time
                start_h, start_m = map(int, times[0].split(":"))
                end_h, end_m = map(int, times[1].split(":"))
                
                dt_start = lesson_date.replace(hour=start_h, minute=start_m)
                dt_end = lesson_date.replace(hour=end_h, minute=end_m)
                
                # Format for ICS
                ts_start = dt_start.strftime("%Y%m%dT%H%M%S")
                ts_end = dt_end.strftime("%Y%m%dT%H%M%S")
                
                event = [
                    "BEGIN:VEVENT",
                    f"DTSTART:{ts_start}",
                    f"DTEND:{ts_end}",
                    f"SUMMARY:{lesson['subject']} ({lesson['lesson_type']})",
                    f"DESCRIPTION:Преподаватель: {lesson['teacher']}",
                    f"LOCATION:{lesson['room']}",
                    f"UID:{lesson['id']}-{week_num}@mxt223.com",
                    "END:VEVENT"
                ]
                cal_content.extend(event)
                
        cal_content.append("END:VCALENDAR")
        
        return Response(content="\n".join(cal_content), media_type="text/calendar")
        
    except Exception as e:
        return Response(content=f"Error: {str(e)}", status_code=500)

@router.get("/debug/seed")
async def debug_seed_schedule():
    """Manual trigger to re-seed schedule"""
    try:
        from app.database import init_db
        
        # DROP tables to ensure schema and data is fresh
        await database.execute("DROP TABLE IF EXISTS schedule")
        await database.execute("DROP TABLE IF EXISTS students")
        
        # Re-create tables with correct schema and seed data
        await init_db()
        
        # Clear cache AGGRESSIVELY
        from utils.cache import clear_cache
        clear_cache()
        
        return {"status": "ok", "seeded": 29}
    except Exception as e:
        logger.exception("Seed error")
        return {"status": "error", "message": str(e)}

@router.get("/debug/check-db")
async def debug_check_db():
    """Check what's actually in the database"""
    try:
        query = "SELECT COUNT(*) as count FROM schedule"
        count_result = await database.fetch_one(query=query)
        
        query2 = "SELECT * FROM schedule LIMIT 3"
        sample = await database.fetch_all(query=query2)
        
        return {
            "total_count": count_result["count"] if count_result else 0,
            "sample": [dict(row) for row in sample]
        }
    except Exception as e:
        return {"error": str(e)}

@router.get("/debug/migrate-admin")
async def debug_migrate_admin():
    """Add is_admin column to students table and optionally promote a user."""
    messages = []
    try:
        try:
            await database.execute("ALTER TABLE students ADD COLUMN is_admin BOOLEAN DEFAULT FALSE")
            messages.append("Added is_admin column")
        except Exception as e:
            messages.append(f"Column creation skipped (probably exists): {e}")

        await database.execute("UPDATE students SET is_admin = TRUE WHERE telegram_id = '1214641616'")
        messages.append("Promoted telegram_id 1214641616 to admin")

        return {"status": "ok", "messages": messages}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.get("/debug/promote-me")
async def debug_promote_me(authorization: str = Header(None)):
    """[Development] Make the current user (from JWT) an admin. Only in ENV=development."""
    from app.config import ENV

    if ENV.lower() == "production":
        return {"status": "error", "message": "Not available in production"}

    if not authorization or not authorization.startswith("Bearer "):
        return {"status": "error", "message": "Authorization Bearer required (log in first)"}

    try:
        from utils.jwt import verify_token, is_jwt_token

        token = authorization.replace("Bearer ", "")
        if not is_jwt_token(token):
            return {"status": "error", "message": "Invalid token"}

        payload = verify_token(token, "access")
        if not payload:
            return {"status": "error", "message": "Invalid or expired token"}

        telegram_id = payload.get("sub")
        if not telegram_id:
            return {"status": "error", "message": "No user in token"}

        await database.execute(
            "UPDATE students SET is_admin = TRUE WHERE telegram_id = :tid",
            {"tid": str(telegram_id)},
        )
        row = await database.fetch_one(
            "SELECT name FROM students WHERE telegram_id = :tid",
            {"tid": str(telegram_id)},
        )
        name = row["name"] if row else telegram_id
        return {"status": "ok", "message": f"Пользователь {name} теперь администратор.", "telegram_id": str(telegram_id)}
    except Exception as e:
        return {"status": "error", "message": str(e)}

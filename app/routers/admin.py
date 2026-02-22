import json
from fastapi import APIRouter, Depends, BackgroundTasks
from app.database import database
from app.dependencies import require_admin
from app.logging_config import logger
from app.models import ScheduleItemCreate, TeacherCreate, AnnouncementUpdate
from app.sanitize import sanitize_text
from pydantic import BaseModel
# Import get_schedule_nocache from schedule router to reuse logic if needed, 
# or just re-implement/import helper. Since routers are separate, we might import the helper.
# Ideally we move get_schedule_data logic to a crud/service layer, but for now we'll duplicate or cross-import.
# For simplicity in this refactor step, we'll re-implement the query or import the router function if possible.
# Actually, calling router functions directly is not best practice. Let's duplicate the simple select query for now to decouple.

router = APIRouter(tags=["Admin"])

@router.get("/admin/check")
async def check_admin_status(user = Depends(require_admin)):
    """Verify admin status"""
    return {"is_admin": True, "name": user["name"]}

@router.get("/admin/stats")
async def get_admin_stats(user = Depends(require_admin)):
    """Get overall system statistics"""
    try:
        # Count stats
        counts = {
            "students": await database.fetch_val("SELECT COUNT(*) FROM students"),
            "teachers": await database.fetch_val("SELECT COUNT(*) FROM teachers"),
            "ratings": await database.fetch_val("SELECT COUNT(*) FROM teacher_ratings"),
            "subscriptions": await database.fetch_val("SELECT COUNT(*) FROM push_subscriptions")
        }
        
        # Check active announcement
        announcement = await database.fetch_one("SELECT COUNT(*) as cnt FROM announcements WHERE is_active = TRUE")
        counts["active_announcement"] = announcement["cnt"] > 0 if announcement else False
        
        return counts
    except Exception as e:
        logger.exception("Stats error")
        return {}

@router.get("/admin/schedule")
async def get_admin_schedule(user = Depends(require_admin)):
    """Get full schedule for admin"""
    # Simple query implementation to avoid circular imports
    try:
        query = "SELECT * FROM schedule ORDER BY pair_number"
        rows = await database.fetch_all(query=query)
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
        return []

@router.post("/admin/schedule")
async def add_schedule_item(item: ScheduleItemCreate, background_tasks: BackgroundTasks, user=Depends(require_admin)):
    """Add new lesson to schedule"""
    try:
        insert_query = """
            INSERT INTO schedule (day_of_week, pair_number, subject, lesson_type, teacher, room, week_start, week_end)
            VALUES (:day, :pair, :subject, :type, :teacher, :room, :week_start, :week_end)
        """
        values = item.model_dump()  # keys: day, pair, subject, type, teacher, room, week_start, week_end
        await database.execute(query=insert_query, values=values)
        row = await database.fetch_one("SELECT id FROM schedule ORDER BY id DESC LIMIT 1")
        lid = row["id"] if row else None
        await database.execute(
            "INSERT INTO schedule_change_log (action, payload_json, changed_by) VALUES ('add', :p, :by)",
            {"p": json.dumps({"lesson_id": lid, **values}), "by": user.get("telegram_id", "")},
        )
        from utils.cache import clear_cache
        clear_cache()
        from app.routers.push import notify_schedule_changed
        background_tasks.add_task(notify_schedule_changed)
        logger.info("schedule_updated", extra={"action": "add", "admin": user.get("telegram_id")})
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.delete("/admin/schedule/{lesson_id}")
async def delete_schedule_item(lesson_id: int, background_tasks: BackgroundTasks, user=Depends(require_admin)):
    """Delete lesson from schedule"""
    try:
        row = await database.fetch_one("SELECT * FROM schedule WHERE id = :id", {"id": lesson_id})
        await database.execute("DELETE FROM schedule WHERE id = :id", {"id": lesson_id})
        await database.execute(
            "INSERT INTO schedule_change_log (action, payload_json, changed_by) VALUES ('delete', :p, :by)",
            {"p": json.dumps(dict(row)) if row else "{}", "by": user.get("telegram_id", "")},
        )
        from utils.cache import clear_cache
        clear_cache()
        from app.routers.push import notify_schedule_changed
        background_tasks.add_task(notify_schedule_changed)
        logger.info("schedule_updated", extra={"action": "delete", "lesson_id": lesson_id, "admin": user.get("telegram_id")})
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.get("/admin/schedule-history")
async def get_schedule_history(user=Depends(require_admin), limit: int = 50):
    """List recent schedule changes (add/delete)."""
    rows = await database.fetch_all(
        "SELECT id, action, payload_json, changed_by, created_at FROM schedule_change_log ORDER BY created_at DESC LIMIT :lim",
        {"lim": limit},
    )
    return [dict(r) for r in rows]

class PollCreateBody(BaseModel):
    question: str
    options: list

@router.post("/admin/polls")
async def create_poll(body: PollCreateBody, user=Depends(require_admin)):
    """Create a new poll."""
    try:
        opts = body.options if isinstance(body.options, list) else []
        await database.execute(
            "INSERT INTO polls (question, options_json, created_by) VALUES (:q, :opts, :by)",
            {"q": body.question[:500], "opts": json.dumps(opts), "by": user.get("telegram_id", "")},
        )
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.get("/admin/polls")
async def list_admin_polls(user=Depends(require_admin)):
    rows = await database.fetch_all("SELECT id, question, options_json, active, created_at FROM polls ORDER BY created_at DESC")
    return [dict(r) for r in rows]

class MaterialCreateBody(BaseModel):
    subject_name: str
    title: str
    url: str

@router.post("/admin/materials")
async def add_material(body: MaterialCreateBody, user=Depends(require_admin)):
    try:
        await database.execute(
            "INSERT INTO subject_materials (subject_name, title, url, uploaded_by) VALUES (:s, :t, :u, :by)",
            {"s": body.subject_name[:200], "t": body.title[:200], "u": body.url[:2000], "by": user.get("telegram_id", "")},
        )
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.delete("/admin/materials/{material_id}")
async def delete_material(material_id: int, user=Depends(require_admin)):
    try:
        await database.execute("DELETE FROM subject_materials WHERE id = :id", {"id": material_id})
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.get("/admin/teachers")
async def get_admin_teachers(user = Depends(require_admin)):
    """Get teacher list for admin"""
    query = "SELECT * FROM teachers ORDER BY name"
    return await database.fetch_all(query=query)

@router.post("/admin/teachers")
async def add_teacher(item: TeacherCreate, user=Depends(require_admin)):
    """Add new teacher"""
    try:
        query = """
            INSERT INTO teachers (name, subject) 
            VALUES (:name, :subject)
        """
        await database.execute(query=query, values=item.model_dump())
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.delete("/admin/teachers/{teacher_id}")
async def delete_teacher(teacher_id: int, user = Depends(require_admin)):
    """Delete teacher"""
    try:
        await database.execute("DELETE FROM teachers WHERE id = :id", {"id": teacher_id})
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.get("/admin/announcement-stats")
async def get_announcement_stats(user=Depends(require_admin)):
    """Read count and total students for 'Прочитали: N из M'."""
    try:
        row = await database.fetch_one("SELECT id FROM announcements WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 1")
        if not row:
            return {"read_count": 0, "total_students": 0}
        r = await database.fetch_one(
            "SELECT COUNT(DISTINCT user_identifier) as cnt FROM announcement_reads WHERE announcement_id = :aid",
            {"aid": row["id"]}
        )
        s = await database.fetch_one("SELECT COUNT(*) as cnt FROM students")
        return {"read_count": r["cnt"] if r else 0, "total_students": s["cnt"] if s else 0}
    except Exception:
        return {"read_count": 0, "total_students": 0}


@router.get("/admin/subject-reviews")
async def list_subject_reviews(user=Depends(require_admin)):
    """List all subject reviews for moderation."""
    try:
        rows = await database.fetch_all("SELECT id, subject_name, body, created_at, moderated FROM subject_reviews ORDER BY created_at DESC LIMIT 100")
        return [dict(r) for r in rows]
    except Exception:
        return []


@router.post("/admin/subject-reviews/{review_id}/moderate")
async def moderate_subject_review(review_id: int, user=Depends(require_admin)):
    """Set review as moderated (visible)."""
    try:
        await database.execute("UPDATE subject_reviews SET moderated = TRUE WHERE id = :id", {"id": review_id})
        return {"success": True}
    except Exception:
        return {"success": False}


@router.post("/admin/announcement")
async def update_announcement(data: AnnouncementUpdate, user=Depends(require_admin)):
    """Update announcement banner. Optional schedule_context: { week_num, day } for «по расписанию»."""
    try:
        import json
        await database.execute("UPDATE announcements SET is_active = FALSE")
        message = sanitize_text(data.message, max_length=2000) if data.message else None
        if message:
            ctx = data.schedule_context
            ctx_str = json.dumps(ctx) if ctx else None
            await database.execute(
                "INSERT INTO announcements (message, is_active, schedule_context) VALUES (:msg, TRUE, :ctx)",
                {"msg": message, "ctx": ctx_str}
            )
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

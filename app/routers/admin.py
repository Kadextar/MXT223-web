from fastapi import APIRouter, Depends
from app.database import database
from app.dependencies import require_admin
# Import get_schedule_nocache from schedule router to reuse logic if needed, 
# or just re-implement/import helper. Since routers are separate, we might import the helper.
# Ideally we move get_schedule_data logic to a crud/service layer, but for now we'll duplicate or cross-import.
# For simplicity in this refactor step, we'll re-implement the query or import the router function if possible.
# Actually, calling router functions directly is not best practice. Let's duplicate the simple select query for now to decouple.

router = APIRouter()

@router.get("/api/admin/check")
async def check_admin_status(user = Depends(require_admin)):
    """Verify admin status"""
    return {"is_admin": True, "name": user["name"]}

@router.get("/api/admin/stats")
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
        print(f"Stats error: {e}")
        return {}

@router.get("/api/admin/schedule")
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

@router.post("/api/admin/schedule")
async def add_schedule_item(item: dict, user = Depends(require_admin)):
    """Add new lesson to schedule"""
    try:
        # Basic validation
        insert_query = """
            INSERT INTO schedule (day_of_week, pair_number, subject, lesson_type, teacher, room, week_start, week_end)
            VALUES (:day, :pair, :subject, :type, :teacher, :room, :week_start, :week_end)
        """
        await database.execute(query=insert_query, values=item)
        
        # Clear cache
        from utils.cache import clear_cache
        clear_cache()
        
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.delete("/api/admin/schedule/{lesson_id}")
async def delete_schedule_item(lesson_id: int, user = Depends(require_admin)):
    """Delete lesson from schedule"""
    try:
        await database.execute("DELETE FROM schedule WHERE id = :id", {"id": lesson_id})
        
        # Clear cache
        from utils.cache import clear_cache
        clear_cache()
        
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.get("/api/admin/teachers")
async def get_admin_teachers(user = Depends(require_admin)):
    """Get teacher list for admin"""
    query = "SELECT * FROM teachers ORDER BY name"
    return await database.fetch_all(query=query)

@router.post("/api/admin/teachers")
async def add_teacher(item: dict, user = Depends(require_admin)):
    """Add new teacher"""
    try:
        query = """
            INSERT INTO teachers (name, subject) 
            VALUES (:name, :subject)
        """
        await database.execute(query=query, values=item)
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.delete("/api/admin/teachers/{teacher_id}")
async def delete_teacher(teacher_id: int, user = Depends(require_admin)):
    """Delete teacher"""
    try:
        await database.execute("DELETE FROM teachers WHERE id = :id", {"id": teacher_id})
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.post("/api/admin/announcement")
async def update_announcement(data: dict, user = Depends(require_admin)):
    """Update announcement banner"""
    try:
        # archive all previous
        await database.execute("UPDATE announcements SET is_active = FALSE")
        
        message = data.get("message")
        if message:
            await database.execute(
                "INSERT INTO announcements (message, is_active) VALUES (:msg, TRUE)",
                {"msg": message}
            )
            
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

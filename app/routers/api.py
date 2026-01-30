from fastapi import APIRouter, Header, HTTPException, Response
from app.database import database
from utils.cache import cached
from app.config import SEMESTER_START, PAIR_TIMES, DAY_MAPPING
from datetime import datetime, timedelta

router = APIRouter()

@router.get("/api/subjects")
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
        print(f"Subjects Error: {e}")
        return []

@router.get("/api/exams")
async def get_exams():
    """Get all exams"""
    try:
        query = "SELECT * FROM exams ORDER BY exam_date"
        return await database.fetch_all(query=query)
    except Exception as e:
        return []

@router.get("/api/ratings")
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
        print(f"Ratings Error: {e}")
        return []

@router.post("/api/rate-teacher")
async def rate_teacher(data: dict, authorization: str = Header(None)):
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
            
        # Hash user_id to keep anonymity but prevent duplicate votes
        user_hash = hashlib.sha256(user_id.encode()).hexdigest()
        
        teacher_id = data.get("teacher_id")
        rating = data.get("rating")
        tags = data.get("tags") # stored as json string or comma separated
        comment = data.get("comment")
        
        if not teacher_id or not rating:
            return {"success": False, "error": "Missing data"}
            
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
        
        return {"success": True}
    except Exception as e:
        print(f"Rate error: {e}")
        return {"success": False, "error": str(e)}

@router.get("/api/announcement")
async def get_announcement():
    """Returns active announcement if exists"""
    try:
        query = "SELECT * FROM announcements WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 1"
        row = await database.fetch_one(query=query)
        if row:
            return {
                "message": row["message"],
                "created_at": str(row["created_at"])
            }
        return None
    except Exception as e:
        print(f"DB Error: {e}")
        return None

@router.get("/api/calendar.ics")
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

@router.get("/api/debug/seed")
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
        print(f"❌ Seed error: {e}")
        return {"status": "error", "message": str(e)}

@router.get("/api/debug/check-db")
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

@router.get("/api/debug/migrate-admin")
async def debug_migrate_admin():
    """Add is_admin column to students table"""
    messages = []
    try:
        # Try to add column directly
        try:
            await database.execute("ALTER TABLE students ADD COLUMN is_admin BOOLEAN DEFAULT FALSE")
            messages.append("Added is_admin column")
        except Exception as e:
            messages.append(f"Column creation skipped (probably exists): {e}")
        
        # Make specific user admin
        await database.execute("UPDATE students SET is_admin = TRUE WHERE telegram_id = '1214641616'") # Azamat
        messages.append("Promoted Azamat to admin")
        
        return {"status": "ok", "messages": messages}
    except Exception as e:
        return {"status": "error", "message": str(e)}

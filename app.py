from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from pathlib import Path
import os
import databases
from dotenv import load_dotenv
from datetime import datetime, timedelta

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent

# Database Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./schedule.db")

database = databases.Database(DATABASE_URL)

app = FastAPI()

app.mount(
    "/static",
    StaticFiles(directory=BASE_DIR / "web" / "static"),
    name="static"
)

# Constants for calendar generation
# Неделя 1 = 12 января (понедельник), Неделя 4 = 2 февраля (начало учёбы МХТ-223)
SEMESTER_START = datetime(2026, 1, 12)  # Понедельник 1-й недели (общий календарь вуза)
PAIR_TIMES = {
    1: ("08:00", "09:20"),
    2: ("09:30", "10:50"),
    3: ("11:00", "12:20")
}

DAY_MAPPING = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4
}

@app.on_event("startup")
async def startup():
    await database.connect()

@app.on_event("shutdown")
async def shutdown():
    await database.disconnect()

@app.get("/")
def index():
    return FileResponse(BASE_DIR / "web" / "index.html")

@app.get("/login.html")
def login():
    return FileResponse(BASE_DIR / "web" / "login.html")

@app.get("/ratings.html")
def ratings():
    return FileResponse(BASE_DIR / "web" / "ratings.html")

@app.get("/manifest.json")
def manifest():
    return FileResponse(BASE_DIR / "web" / "manifest.json", media_type="application/manifest+json")

@app.get("/sw.js")
def service_worker():
    return FileResponse(BASE_DIR / "web" / "sw.js", media_type="application/javascript")

@app.get("/health")
def health():
    return {"status": "ok"}

# Authentication API
from pydantic import BaseModel

class LoginRequest(BaseModel):
    telegram_id: str
    password: str

class ChangePasswordRequest(BaseModel):
    telegram_id: str
    old_password: str
    new_password: str

@app.post("/api/login")
async def login_student(request: LoginRequest):
    """Authenticate student with telegram_id and password"""
    try:
        query = "SELECT telegram_id, name FROM students WHERE telegram_id = $1 AND password = $2"
        student = await database.fetch_one(query=query, values=[request.telegram_id, request.password])
        
        if student:
            return {
                "success": True,
                "telegram_id": student["telegram_id"],
                "name": student["name"]
            }
        else:
            return {"success": False, "error": "Неверный ID или пароль"}
    except Exception as e:
        print(f"Login error: {e}")
        return {"success": False, "error": f"Ошибка сервера: {str(e)}"}

@app.post("/api/change-password")
async def change_password(request: ChangePasswordRequest):
    """Change student password"""
    try:
        # Verify old password
        check_query = "SELECT id FROM students WHERE telegram_id = $1 AND password = $2"
        student = await database.fetch_one(query=check_query, values=[request.telegram_id, request.old_password])
        
        if not student:
            return {"success": False, "error": "Неверный старый пароль"}
        
        # Update password
        update_query = "UPDATE students SET password = $1 WHERE telegram_id = $2"
        await database.execute(query=update_query, values=[request.new_password, request.telegram_id])
        
        return {"success": True, "message": "Пароль успешно изменён"}
    except Exception as e:
        print(f"Password change error: {e}")
        return {"success": False, "error": "Ошибка сервера"}

@app.get("/api/schedule")
async def get_schedule():
    """Returns all lessons from database in a format compatible with frontend"""
    try:
        query = "SELECT * FROM schedule ORDER BY pair_number"
        rows = await database.fetch_all(query=query)
    except Exception as e:
        print(f"DB Error: {e}")
        return []

    schedule = []
    for row in rows:
        schedule.append({
            "day": row["day_of_week"],
            "pair": row["pair_number"],
            "subject": row["subject"],
            "type": row["lesson_type"],
            "weeks": [row["week_start"], row["week_end"]],
            "room": row["room"],
            "teacher": row["teacher"]
        })
    
    return schedule

@app.get("/api/announcement")
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

# Teacher Rating API Endpoints
@app.get("/api/teachers")
async def get_teachers():
    """Returns list of all teachers with ratings"""
    try:
        query = "SELECT * FROM teachers ORDER BY average_rating DESC"
        rows = await database.fetch_all(query=query)
        teachers = []
        for row in rows:
            teachers.append({
                "id": row["id"],
                "name": row["name"],
                "subject": row["subject"],
                "average_rating": float(row["average_rating"]) if row["average_rating"] else 0,
                "total_ratings": row["total_ratings"]
            })
        return teachers
    except Exception as e:
        print(f"DB Error: {e}")
        return []

@app.get("/api/teachers/{teacher_id}")
async def get_teacher_details(teacher_id: int):
    """Returns teacher details with all ratings"""
    try:
        # Get teacher info
        teacher_query = "SELECT * FROM teachers WHERE id = $1"
        teacher = await database.fetch_one(query=teacher_query, values=[teacher_id])
        
        if not teacher:
            return {"error": "Teacher not found"}
        
        # Get all ratings (anonymous)
        ratings_query = "SELECT rating, tags, comment, created_at FROM teacher_ratings WHERE teacher_id = $1 ORDER BY created_at DESC"
        ratings_rows = await database.fetch_all(query=ratings_query, values=[teacher_id])
        
        ratings = []
        for row in ratings_rows:
            ratings.append({
                "rating": row["rating"],
                "tags": row["tags"],
                "comment": row["comment"],
                "created_at": str(row["created_at"])
            })
        
        return {
            "id": teacher["id"],
            "name": teacher["name"],
            "subject": teacher["subject"],
            "average_rating": float(teacher["average_rating"]) if teacher["average_rating"] else 0,
            "total_ratings": teacher["total_ratings"],
            "ratings": ratings
        }
    except Exception as e:
        print(f"DB Error: {e}")
        return {"error": str(e)}

from pydantic import BaseModel

class RatingSubmission(BaseModel):
    student_id: str
    rating: int
    tags: str = None
    comment: str = None

@app.post("/api/teachers/{teacher_id}/rate")
async def submit_rating(teacher_id: int, submission: RatingSubmission):
    """Submit or update a rating for a teacher"""
    try:
        import hashlib
        
        # Hash student ID for anonymity
        student_hash = hashlib.sha256(f"{submission.student_id}mxt223_secret".encode()).hexdigest()
        
        # Check if rating exists
        check_query = "SELECT id FROM teacher_ratings WHERE teacher_id = $1 AND student_hash = $2"
        existing = await database.fetch_one(query=check_query, values=[teacher_id, student_hash])
        
        if existing:
            # Update existing rating
            update_query = """
                UPDATE teacher_ratings 
                SET rating = $1, tags = $2, comment = $3, updated_at = CURRENT_TIMESTAMP 
                WHERE teacher_id = $4 AND student_hash = $5
            """
            await database.execute(query=update_query, values=[
                submission.rating, submission.tags, submission.comment, teacher_id, student_hash
            ])
        else:
            # Insert new rating
            insert_query = """
                INSERT INTO teacher_ratings (teacher_id, student_hash, rating, tags, comment)
                VALUES ($1, $2, $3, $4, $5)
            """
            await database.execute(query=insert_query, values=[
                teacher_id, student_hash, submission.rating, submission.tags, submission.comment
            ])
        
        # Update teacher's average rating
        stats_query = "SELECT AVG(rating) as avg_rating, COUNT(*) as total FROM teacher_ratings WHERE teacher_id = $1"
        stats = await database.fetch_one(query=stats_query, values=[teacher_id])
        
        avg_rating = round(float(stats["avg_rating"]), 2) if stats["avg_rating"] else 0
        total_ratings = stats["total"]
        
        update_teacher_query = "UPDATE teachers SET average_rating = $1, total_ratings = $2 WHERE id = $3"
        await database.execute(query=update_teacher_query, values=[avg_rating, total_ratings, teacher_id])
        
        return {"success": True, "average_rating": avg_rating, "total_ratings": total_ratings}
    except Exception as e:
        print(f"DB Error: {e}")
        return {"error": str(e)}

@app.get("/api/teachers/{teacher_id}/my-rating/{student_id}")
async def get_my_rating(teacher_id: int, student_id: str):
    """Get student's own rating for editing"""
    try:
        import hashlib
        student_hash = hashlib.sha256(f"{student_id}mxt223_secret".encode()).hexdigest()
        
        query = "SELECT rating, tags, comment FROM teacher_ratings WHERE teacher_id = $1 AND student_hash = $2"
        rating = await database.fetch_one(query=query, values=[teacher_id, student_hash])
        
        if rating:
            return {
                "rating": rating["rating"],
                "tags": rating["tags"],
                "comment": rating["comment"]
            }
        return None
    except Exception as e:
        print(f"DB Error: {e}")
        return None

@app.get("/api/teachers/{teacher_id}/today-lessons")
async def get_teacher_today_lessons(teacher_id: int):
    """Get today's lessons for a teacher with completion status"""
    try:
        from datetime import datetime, time
        import pytz
        
        # Get teacher info
        teacher_query = "SELECT name FROM teachers WHERE id = $1"
        teacher = await database.fetch_one(query=teacher_query, values=[teacher_id])
        
        if not teacher:
            return {"error": "Teacher not found"}
        
        teacher_name = teacher["name"]
        
        # Get current time in Tashkent timezone
        tz = pytz.timezone('Asia/Tashkent')
        now = datetime.now(tz)
        current_time = now.time()
        current_weekday = now.weekday()  # 0=Monday, 6=Sunday
        
        # Calculate current week number
        semester_start = datetime(2026, 1, 12, tzinfo=tz)
        days_since_start = (now - semester_start).days
        current_week = (days_since_start // 7) + 1
        
        # Map weekday to day name
        day_names = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']
        today_name = day_names[current_weekday]
        
        # Get today's lessons for this teacher
        query = """
            SELECT * FROM schedule 
            WHERE teacher = $1 
            AND day_of_week = $2 
            AND week_start <= $3 
            AND week_end >= $3
            ORDER BY pair_number
        """
        lessons = await database.fetch_all(query=query, values=[teacher_name, today_name, current_week])
        
        # Check which lessons are completed
        pair_times = {
            1: time(9, 20),   # Ends at 09:20
            2: time(10, 50),  # Ends at 10:50
            3: time(12, 20)   # Ends at 12:20
        }
        
        result = []
        for lesson in lessons:
            pair_num = lesson["pair_number"]
            end_time = pair_times.get(pair_num)
            is_completed = current_time > end_time if end_time else False
            
            result.append({
                "pair_number": pair_num,
                "subject": lesson["subject"],
                "lesson_type": lesson["lesson_type"],
                "room": lesson["room"],
                "is_completed": is_completed
            })
        
        return {
            "teacher_id": teacher_id,
            "teacher_name": teacher_name,
            "today": today_name,
            "lessons": result
        }
    except Exception as e:
        print(f"DB Error: {e}")
        return {"error": str(e)}

@app.get("/api/calendar.ics")
async def export_calendar():
    """Generate .ics file with all semester lessons"""
    try:
        query = "SELECT * FROM schedule ORDER BY day_of_week, pair_number"
        rows = await database.fetch_all(query=query)
    except Exception as e:
        print(f"DB Error: {e}")
        return Response(content="", media_type="text/calendar")
    
    # Generate iCalendar content
    ics_lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//MXT223 Schedule//RU",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:Расписание MXT-223",
        "X-WR-TIMEZONE:Asia/Tashkent"
    ]
    
    event_id = 1
    for row in rows:
        day_name = row["day_of_week"]
        pair_num = row["pair_number"]
        subject = row["subject"]
        lesson_type = "Лекция" if row["lesson_type"] == "lecture" else "Семинар"
        week_start = row["week_start"]
        week_end = row["week_end"]
        room = row["room"]
        teacher = row["teacher"]
        
        if day_name not in DAY_MAPPING or pair_num not in PAIR_TIMES:
            continue
        
        day_offset = DAY_MAPPING[day_name]
        start_time, end_time = PAIR_TIMES[pair_num]
        
        # Generate events for each week
        for week_num in range(week_start, week_end + 1):
            # Calculate date for this week
            days_from_start = (week_num - 1) * 7 + day_offset
            event_date = SEMESTER_START + timedelta(days=days_from_start)
            
            # Parse times
            start_hour, start_min = map(int, start_time.split(":"))
            end_hour, end_min = map(int, end_time.split(":"))
            
            dt_start = event_date.replace(hour=start_hour, minute=start_min)
            dt_end = event_date.replace(hour=end_hour, minute=end_min)
            
            # Format for iCalendar (YYYYMMDDTHHMMSS)
            dtstart_str = dt_start.strftime("%Y%m%dT%H%M%S")
            dtend_str = dt_end.strftime("%Y%m%dT%H%M%S")
            dtstamp = datetime.now().strftime("%Y%m%dT%H%M%SZ")
            
            ics_lines.extend([
                "BEGIN:VEVENT",
                f"UID:mxt223-{event_id}@schedule.uz",
                f"DTSTAMP:{dtstamp}",
                f"DTSTART:{dtstart_str}",
                f"DTEND:{dtend_str}",
                f"SUMMARY:{subject} ({lesson_type})",
                f"LOCATION:{room}",
                f"DESCRIPTION:Преподаватель: {teacher}\\nТип: {lesson_type}\\nНеделя: {week_num}",
                "STATUS:CONFIRMED",
                "TRANSP:OPAQUE",
                "END:VEVENT"
            ])
            event_id += 1
    
    ics_lines.append("END:VCALENDAR")
    ics_content = "\r\n".join(ics_lines)
    
    return Response(
        content=ics_content,
        media_type="text/calendar",
        headers={"Content-Disposition": "attachment; filename=mxt223-schedule.ics"}
    )
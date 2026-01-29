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
SEMESTER_START = datetime(2026, 2, 3)  # 3 февраля 2026 (понедельник 1-й недели)
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

@app.get("/manifest.json")
def manifest():
    return FileResponse(BASE_DIR / "web" / "manifest.json", media_type="application/manifest+json")

@app.get("/sw.js")
def service_worker():
    return FileResponse(BASE_DIR / "web" / "sw.js", media_type="application/javascript")

@app.get("/health")
def health():
    return {"status": "ok"}

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
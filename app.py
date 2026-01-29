from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
import os
import databases
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent

# Database Configuration
# Если переменная не задана, пытаемся использовать локальный sqlite файл (если он есть рядом)
# Для Railway нужно задать DATABASE_URL
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./schedule.db")

database = databases.Database(DATABASE_URL)

app = FastAPI()

app.mount(
    "/static",
    StaticFiles(directory=BASE_DIR / "web" / "static"),
    name="static"
)

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
    # Если таблицы нет (первый запуск без миграции), вернем пустое
    try:
        query = "SELECT * FROM schedule ORDER BY pair_number"
        rows = await database.fetch_all(query=query)
    except Exception as e:
        print(f"DB Error: {e}")
        return []

    # Map DB rows to Frontend format
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
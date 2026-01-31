from fastapi import APIRouter
from fastapi.responses import FileResponse
from app.config import BASE_DIR

router = APIRouter()

@router.get("/")
def index():
    return FileResponse(BASE_DIR / "web" / "index.html")

@router.get("/index.html")
def index_file():
    return FileResponse(BASE_DIR / "web" / "index.html")

@router.get("/login.html")
def login():
    return FileResponse(BASE_DIR / "web" / "login.html")

@router.get("/ratings.html")
def ratings():
    return FileResponse(BASE_DIR / "web" / "ratings.html")

@router.get("/profile.html")
def profile():
    return FileResponse(BASE_DIR / "web" / "profile.html")

@router.get("/academics.html")
def academics_page():
    return FileResponse(BASE_DIR / "web" / "academics.html")

@router.get("/admin.html")
def admin_page():
    return FileResponse(BASE_DIR / "web" / "admin.html")

@router.get("/subjects.html")
def subjects():
    return FileResponse(BASE_DIR / "web" / "subjects.html")

@router.get("/exams.html")
def exams():
    return FileResponse(BASE_DIR / "web" / "exams.html")

@router.get("/manifest.json")
def manifest():
    return FileResponse(BASE_DIR / "web" / "manifest.json", media_type="application/manifest+json")

@router.get("/sw.js")
def service_worker():
    return FileResponse(BASE_DIR / "web" / "sw.js", media_type="application/javascript")

@router.get("/health")
def health():
    return {"status": "ok"}

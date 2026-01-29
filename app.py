from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

app = FastAPI()

app.mount(
    "/static",
    StaticFiles(directory=BASE_DIR / "web" / "static"),
    name="static"
)

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
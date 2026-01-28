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

@app.get("/health")
def health():
    return {"status": "ok"}
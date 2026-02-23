from typing import Optional

from fastapi import APIRouter
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from app.config import BASE_DIR, APP_VERSION, ENV, REDIS_URL
from app.database import database

router = APIRouter(tags=["Pages"])
WEB_DIR = BASE_DIR / "web"

DAY_SHORT = {"mon": "monday", "tue": "tuesday", "wed": "wednesday", "thu": "thursday", "fri": "friday"}

# Короткая ссылка: /p/3-mon-2 -> редирект на /?week=3&day=monday#lesson-2
@router.get("/p/{path:path}")
async def short_link(path: str):
    parts = path.strip("/").split("-")
    if len(parts) < 2:
        return RedirectResponse(url="/", status_code=302)
    try:
        week = int(parts[0])
        day = DAY_SHORT.get(parts[1].lower(), "monday")
        pair = int(parts[2]) if len(parts) > 2 else None
        url = f"/?week={week}&day={day}"
        if pair:
            url += f"#lesson-{pair}"
        return RedirectResponse(url=url, status_code=302)
    except (ValueError, IndexError):
        return RedirectResponse(url="/", status_code=302)

# Статические страницы: путь в URL -> (файл, опциональный media_type)
PAGE_ROUTES = [
    ("/", "index.html", None),
    ("/index.html", "index.html", None),
    ("/login.html", "login.html", None),
    ("/ratings.html", "ratings.html", None),
    ("/profile.html", "profile.html", None),
    ("/academics.html", "academics.html", None),
    ("/exams.html", "exams.html", None),
    ("/admin.html", "admin.html", None),
    ("/promote-me.html", "promote-me.html", None),
    ("/offline.html", "offline.html", None),
    ("/next", "next.html", None),
    ("/manifest.json", "manifest.json", "application/manifest+json"),
    ("/sw.js", "sw.js", "application/javascript"),
]


@router.get("/metrics")
async def metrics():
    """Prometheus metrics (request count, error count)."""
    from fastapi.responses import PlainTextResponse
    from app.metrics import get_prometheus_export
    return PlainTextResponse(get_prometheus_export(), media_type="text/plain; charset=utf-8")


@router.get("/health/live")
async def health_live():
    """Liveness only (no DB). For k8s liveness probe."""
    return {"status": "ok", "version": APP_VERSION, "env": ENV}


@router.get("/health")
async def health():
    """Readiness: 200 with deps status (DB, optional Redis). 503 if any critical dep down."""
    deps = {}
    try:
        await database.fetch_one("SELECT 1")
        deps["database"] = "connected"
    except Exception:
        deps["database"] = "disconnected"
    if REDIS_URL:
        try:
            import redis.asyncio as redis_async  # type: ignore
            r = redis_async.from_url(REDIS_URL)
            await r.ping()
            await r.aclose()
            deps["redis"] = "connected"
        except Exception:
            deps["redis"] = "disconnected"
    healthy = deps.get("database") == "connected"
    body = {
        "status": "ok" if healthy else "unhealthy",
        "version": APP_VERSION,
        "env": ENV,
        "dependencies": deps,
    }
    if not healthy:
        return JSONResponse(status_code=503, content=body)
    return body


def _make_file_route(path: str, filename: str, media_type: Optional[str]):
    def _handler():
        return FileResponse(
            WEB_DIR / filename,
            media_type=media_type,
        )
    return _handler


for _path, _file, _media in PAGE_ROUTES:
    router.get(_path)(_make_file_route(_path, _file, _media))

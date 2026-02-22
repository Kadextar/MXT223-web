import os
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.gzip import GZipMiddleware
from starlette.requests import Request

from app.config import BASE_DIR, SENTRY_DSN, CORS_ORIGINS, APP_VERSION, IS_PRODUCTION, ENV, LOG_JSON
from app.database import database, init_db
from app.logging_config import setup_logging, logger
from app.middleware import (
    ApiRateLimitMiddleware,
    HTTPSRedirectMiddleware,
    RequestIDMiddleware,
    RequestLoggingMiddleware,
    SecurityHeadersMiddleware,
)
from app.routers import auth, schedule, admin, push, api, pages, ratings, extras

setup_logging(level=os.getenv("LOG_LEVEL", "INFO"), json_log=LOG_JSON)

# Warn or fail if production runs with default JWT secret
def _check_jwt_secret():
    from utils.jwt import SECRET_KEY
    default = "your-secret-key-change-this-in-production"
    if IS_PRODUCTION and (not SECRET_KEY or SECRET_KEY == default):
        logger.critical(
            "JWT_SECRET_KEY is default or unset in production. Set a strong secret in .env"
        )
        raise RuntimeError("JWT_SECRET_KEY must be set in production")
    elif not IS_PRODUCTION and SECRET_KEY == default:
        logger.warning("Using default JWT_SECRET_KEY. Set JWT_SECRET_KEY in .env for production.")

if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        environment=ENV,
        traces_sample_rate=0.1,
        _experiments={"profiles_sample_rate": 0.1},
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    _check_jwt_secret()
    await database.connect()
    try:
        await init_db()
        from app.scheduler import start_scheduler
        start_scheduler()
    except Exception as e:
        logger.critical("Startup failed: %s", e, exc_info=True)
    yield
    from app.scheduler import shutdown_scheduler
    await shutdown_scheduler()
    await database.disconnect()


def _request_id(request: Request) -> str:
    return getattr(request.state, "request_id", None) or ""


app = FastAPI(
    title="MXT223",
    description="Расписание и рейтинги для группы МХТ-223",
    version=APP_VERSION,
    lifespan=lifespan,
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
)

# Standard API error format: detail, code, request_id; 404 → custom page for non-API
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    if exc.status_code == 404 and not request.url.path.startswith("/api"):
        return FileResponse(BASE_DIR / "web" / "404.html", status_code=404)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "code": exc.status_code,
            "request_id": _request_id(request),
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "detail": exc.errors(),
            "code": 422,
            "request_id": _request_id(request),
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception")
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "code": 500,
            "request_id": _request_id(request),
        },
    )


# Middleware order: last added = first executed
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(ApiRateLimitMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=256)
app.add_middleware(HTTPSRedirectMiddleware)
app.add_middleware(RequestIDMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Static Files
app.mount(
    "/static",
    StaticFiles(directory=BASE_DIR / "web" / "static"),
    name="static",
)

# API prefix so /schedule -> /api/schedule and /api/v1/schedule
API_PREFIX = "/api"
API_V1_PREFIX = "/api/v1"
for router_module in (auth, schedule, api, push, admin, ratings, extras):
    app.include_router(router_module.router, prefix=API_PREFIX)
    app.include_router(router_module.router, prefix=API_V1_PREFIX)
app.include_router(pages.router)

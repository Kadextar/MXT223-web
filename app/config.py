from pathlib import Path
import os
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent


def _get_version() -> str:
    """Single source of truth: read from pyproject.toml or fallback."""
    import re
    try:
        with open(BASE_DIR / "pyproject.toml", "r", encoding="utf-8") as f:
            content = f.read()
        m = re.search(r'^version\s*=\s*["\']([^"\']+)["\']', content, re.MULTILINE)
        return m.group(1) if m else "1.0.0"
    except Exception:
        return "1.0.0"


# App (version from pyproject.toml)
APP_VERSION = _get_version()
ENV = os.getenv("ENV", "development")
IS_PRODUCTION = ENV.lower() == "production"

# Database Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./schedule.db")
# Timeout in seconds for DB connect/query (PostgreSQL: append ?connect_timeout=N to URL)
DATABASE_CONNECT_TIMEOUT = int(os.getenv("DATABASE_CONNECT_TIMEOUT", "10"))

# Cache TTL for schedule/subjects/ratings (seconds)
CACHE_TTL_SECONDS = int(os.getenv("CACHE_TTL_SECONDS", "300"))

# Rate limit: max requests per window for login/refresh
RATE_LIMIT_REQUESTS = int(os.getenv("RATE_LIMIT_REQUESTS", "5"))
RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))
# Global API rate limit per IP (all /api/*)
API_RATE_LIMIT_REQUESTS = int(os.getenv("API_RATE_LIMIT_REQUESTS", "120"))
API_RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("API_RATE_LIMIT_WINDOW_SECONDS", "60"))

# Redis (optional): for schedule cache and health
REDIS_URL = os.getenv("REDIS_URL", "").strip()

# JWT expiry (minutes / days)
JWT_ACCESS_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_EXPIRE_MINUTES", "15"))
JWT_REFRESH_EXPIRE_DAYS = int(os.getenv("JWT_REFRESH_EXPIRE_DAYS", "7"))
REMEMBER_ME_REFRESH_DAYS = int(os.getenv("REMEMBER_ME_REFRESH_DAYS", "30"))
PASSWORD_RESET_EXPIRE_MINUTES = int(os.getenv("PASSWORD_RESET_EXPIRE_MINUTES", "60"))
NOTIFY_BEFORE_LESSON_MINUTES = int(os.getenv("NOTIFY_BEFORE_LESSON_MINUTES", "10"))

# Avatar: allowed filename pattern (e.g. 1.png, 42.png), max length
AVATAR_MAX_LENGTH = int(os.getenv("AVATAR_MAX_LENGTH", "64"))
AVATAR_ALLOWED_PATTERN = r"^[a-zA-Z0-9_\-]+\.(png|jpg|jpeg|gif|webp)$"

# Logging: 1 = JSON lines (for Loki/CloudWatch), 0 = human
LOG_JSON = os.getenv("LOG_JSON", "").strip().lower() in ("1", "true", "yes")

# Feature flags (env: FEATURE_new_ratings_ui=1)
FEATURE_FLAGS = {
    "new_ratings_ui": os.getenv("FEATURE_new_ratings_ui", "").strip().lower() in ("1", "true", "yes"),
    "optimistic_notes": True,
}

# VAPID Keys for Push Notifications (generate: scripts/generate_vapid_keys.py)
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY")
VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY")
VAPID_CLAIM_EMAIL = os.getenv("VAPID_CLAIM_EMAIL", "mailto:admin@mxt223.com")

# Sentry DSN
SENTRY_DSN = os.getenv("SENTRY_DSN")

# CORS: comma-separated origins, or empty for allow all (dev)
_cors = os.getenv("CORS_ORIGINS", "").strip()
CORS_ORIGINS = [o.strip() for o in _cors.split(",") if o.strip()] if _cors else []

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

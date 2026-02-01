from pathlib import Path
import os
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

# Database Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./schedule.db")

# VAPID Keys for Push Notifications
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY")
VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "BIXAbfTsvZxslOFPeyLZ-R2mxNla936P_69FI1dNYW4-nE82_TQVQ_0qHxuWKoKJDjwsiPB7ZHZToxJLq3HZE9g")
VAPID_CLAIM_EMAIL = os.getenv("VAPID_CLAIM_EMAIL", "mailto:admin@mxt223.com")

# Sentry DSN
SENTRY_DSN = os.getenv("SENTRY_DSN")

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

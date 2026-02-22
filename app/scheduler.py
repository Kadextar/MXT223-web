import asyncio
import logging
from datetime import datetime, timedelta
import pytz
from apscheduler.schedulers.asyncio import AsyncIOScheduler


def _row_to_dict(row):
    """Convert DB Record to dict (Record has no .get(), only __getitem__)."""
    if isinstance(row, dict):
        return row
    try:
        return dict(row)
    except Exception:
        return {k: row[k] for k in row.keys()} if hasattr(row, "keys") else {}
from apscheduler.triggers.cron import CronTrigger
from app.database import database
from app.config import VAPID_PRIVATE_KEY, VAPID_CLAIM_EMAIL, SEMESTER_START, NOTIFY_BEFORE_LESSON_MINUTES
from pywebpush import webpush, WebPushException
import json

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Timezone (Tashkent)
TZ = pytz.timezone('Asia/Tashkent')

# Pair Times (Standardized for MXT-223 from schedule_data.js)
PAIR_START_TIMES = {
    1: "08:00",
    2: "09:30",
    3: "11:00",
    4: "12:30", # Assumed continuation
    5: "14:00",
    6: "15:30"
}

scheduler = AsyncIOScheduler()

DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday"]


async def check_upcoming_lessons():
    """Send push if a lesson starts in NOTIFY_BEFORE_LESSON_MINUTES. Runs every minute."""
    now = datetime.now(TZ)
    target_time = now + timedelta(minutes=NOTIFY_BEFORE_LESSON_MINUTES)
    target_hour = target_time.hour
    target_minute = target_time.minute

    upcoming_pair = None
    for pair_num, start_time in PAIR_START_TIMES.items():
        h, m = map(int, start_time.split(':'))
        if h == target_hour and m == target_minute:
            upcoming_pair = pair_num
            break
    if not upcoming_pair:
        return

    day_idx = now.weekday()
    if day_idx >= 5:
        return
    day_name = DAY_NAMES[day_idx]
    delta = now.date() - SEMESTER_START.date()
    week_num = max(1, (delta.days // 7) + 1)

    query = """
        SELECT * FROM schedule
        WHERE day_of_week = :day
        AND pair_number = :pair
        AND week_start <= :week AND week_end >= :week
    """
    lessons = await database.fetch_all(query, values={
        "day": day_name,
        "pair": upcoming_pair,
        "week": week_num,
    })
    
    if not lessons:
        return

    logger.info(f"Found {len(lessons)} lessons starting soon.")

    # Fetch all subscribers (convert to dict: Record has no .get(), only __getitem__)
    rows = await database.fetch_all("SELECT * FROM push_subscriptions")
    if not rows:
        return

    subs = [_row_to_dict(r) for r in rows]

    for lesson in lessons:
        lesson_dict = _row_to_dict(lesson)
        message = f"Через {NOTIFY_BEFORE_LESSON_MINUTES} мин.: {lesson_dict.get('subject', '')} ({lesson_dict.get('lesson_type', '')}) в {lesson_dict.get('room', '')}."
        
        for sub in subs:
            try:
                subscription_info = json.loads(sub.get("subscription_data") or "{}")
                payload = json.dumps({
                    "title": "Напоминание ⏰",
                    "body": message,
                    "url": "/",
                    "icon": "/static/icons/icon-192x192.png"
                })
                webpush(
                    subscription_info=subscription_info,
                    data=payload,
                    vapid_private_key=VAPID_PRIVATE_KEY,
                    vapid_claims={"sub": VAPID_CLAIM_EMAIL}
                )
            except WebPushException as ex:
                if ex.response and ex.response.status_code in [404, 410]:
                    await database.execute("DELETE FROM push_subscriptions WHERE id = :id", {"id": sub["id"]})
            except Exception as e:
                logger.error(f"Push error: {e}")

def start_scheduler():
    scheduler.add_job(check_upcoming_lessons, CronTrigger(second='0')) # Run every minute at 00s
    scheduler.start()
    logger.info("Scheduler started!")

async def shutdown_scheduler():
    scheduler.shutdown()

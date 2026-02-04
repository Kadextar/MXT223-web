import asyncio
import logging
from datetime import datetime, timedelta
import pytz
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from app.database import database
from app.config import VAPID_PRIVATE_KEY, VAPID_CLAIM_EMAIL
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

async def check_upcoming_lessons():
    """
    For each subscriber, checks if a lesson starts in their reminder_minutes and sends notification.
    Runs every minute.
    """
    now = datetime.now(TZ)
    WEEKDAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    day_of_week = WEEKDAY_NAMES[now.weekday()]
    current_date = now.date()

    subs = await database.fetch_all("SELECT * FROM push_subscriptions")
    if not subs:
        return

    for sub in subs:
        rem = int(sub.get("reminder_minutes") or 15)
        if rem not in (5, 15, 30):
            rem = 15
        target_time = now + timedelta(minutes=rem)
        target_hour, target_minute = target_time.hour, target_time.minute

        upcoming_pair = None
        for pair_num, start_time in PAIR_START_TIMES.items():
            h, m = map(int, start_time.split(':'))
            if h == target_hour and m == target_minute:
                upcoming_pair = pair_num
                break
        if not upcoming_pair:
            continue

        query = """
            SELECT * FROM schedule
            WHERE day_of_week = :day AND pair_number = :pair
            AND :today >= week_start AND :today <= week_end
        """
        lessons = await database.fetch_all(query, values={
            "day": day_of_week, "pair": upcoming_pair, "today": current_date
        })
        if not lessons:
            continue

        for lesson in lessons:
            message = f"Через {rem} мин: {lesson['subject']} ({lesson['lesson_type']}) в {lesson['room']}."
            try:
                subscription_info = json.loads(sub["subscription_data"])
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

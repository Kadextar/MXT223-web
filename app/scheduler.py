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

# Pair Times (Start Times) - MXT-223 uses these standardized times
PAIR_START_TIMES = {
    1: "08:30",
    2: "10:00",
    3: "11:30",
    4: "13:00",  # Lunch break usually 13:00-13:30 or 12:40-13:20, assumes standard grid
    5: "14:30",
    6: "16:00"
}

scheduler = AsyncIOScheduler()

async def check_upcoming_lessons():
    """
    Checks if a lesson starts in ~15 minutes and sends notifications.
    Runs every minute.
    """
    now = datetime.now(TZ)
    # Target time is 15 minutes from now
    target_time = now + timedelta(minutes=15)
    
    target_hour = target_time.hour
    target_minute = target_time.minute
    
    # Check if any pair starts at this target time
    upcoming_pair = None
    for pair_num, start_time in PAIR_START_TIMES.items():
        h, m = map(int, start_time.split(':'))
        # Allow a small window (e.g. checks every minute, so exact match is fine)
        if h == target_hour and m == target_minute:
            upcoming_pair = pair_num
            break
            
    if not upcoming_pair:
        return

    # Determine current day of week (Monday=0, Sunday=6)
    # Our DB uses 0=Monday
    day_of_week = now.weekday()
    
    # Determine current week type (Odd/Even or Week Number) if needed
    # For MVP, we just notify if there is *any* lesson for this group/subgroup.
    # Ideally we should filter by week number.
    
    # Calculate week number from semester start (Feb 14, 2025? No, user said Jan 26 was week 3? 
    # Let's rely on the schedule query returning valid lessons generally or implementing week logic)
    # Actually, the DB has 'week_start' and 'week_end' for each lesson entry?
    # No, DB schema for `schedule` table has `week_start` and `week_end` columns which define the range.
    # We need to check if TODAY is within that range.
    current_date = now.date()
    
    logger.info(f"Checking lessons for Day {day_of_week}, Pair {upcoming_pair} at {target_time.strftime('%H:%M')}")

    # Fetch lessons matching Day + Pair + Date Range
    query = """
        SELECT * FROM schedule 
        WHERE day_of_week = :day 
        AND pair_number = :pair
        AND :today >= week_start AND :today <= week_end
    """
    
    lessons = await database.fetch_all(query=query, values={
        "day": day_of_week, 
        "pair": upcoming_pair,
        "today": current_date
    })
    
    if not lessons:
        return

    logger.info(f"Found {len(lessons)} lessons starting soon.")

    # Fetch all subscribers
    subs = await database.fetch_all("SELECT * FROM push_subscriptions")
    if not subs:
        return

    # For each lesson (usually just 1 common, or 2 for subgroups), notify relevant users.
    # Since we don't have user subgroups stored yet, we send to ALL.
    # TODO: Filter by subgroup if user profile has it.

    for lesson in lessons:
        message = f"Через 15 минут: {lesson['subject']} ({lesson['lesson_type']}) в {lesson['room']}."
        
        # Send to all
        for sub in subs:
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

from fastapi import APIRouter, Header, Depends
from app.database import database
from app.config import VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_CLAIM_EMAIL
from app.dependencies import require_admin
import json
from pywebpush import webpush, WebPushException

router = APIRouter()

@router.post("/api/subscribe")
async def subscribe_push(data: dict, authorization: str = Header(None)):
    """Subscribe to push notifications. Body may include reminder_minutes: 5, 15, or 30."""
    try:
        student_id = "anonymous"
        if authorization:
            from utils.jwt import verify_token, is_jwt_token
            token = authorization.replace("Bearer ", "")
            if is_jwt_token(token):
                payload = verify_token(token, "access")
                if payload:
                    student_id = payload.get("sub")
            else:
                student_id = token

        if "endpoint" in data:
            subscription_json = json.dumps(data)
            reminder = 15
        else:
            sub = data.get("subscription") or data
            subscription_json = json.dumps(sub)
            reminder = data.get("reminder_minutes", 15)
        if reminder not in (5, 15, 30):
            reminder = 15

        check_query = "SELECT id FROM push_subscriptions WHERE student_id = :sid"
        existing = await database.fetch_one(query=check_query, values={"sid": student_id})

        if existing:
            await database.execute(
                "UPDATE push_subscriptions SET subscription_data = :data, reminder_minutes = :rem WHERE student_id = :sid",
                {"data": subscription_json, "rem": reminder, "sid": student_id}
            )
        else:
            await database.execute(
                "INSERT INTO push_subscriptions (student_id, subscription_data, reminder_minutes) VALUES (:sid, :data, :rem)",
                {"sid": student_id, "data": subscription_json, "rem": reminder}
            )
        return {"success": True}
    except Exception as e:
        print(f"Subscribe error: {e}")
        return {"success": False, "error": str(e)}


@router.patch("/api/subscribe-settings")
async def update_subscribe_settings(data: dict, authorization: str = Header(None)):
    """Update reminder_minutes for current user (must be subscribed)."""
    try:
        if not authorization:
            return {"success": False, "error": "Unauthorized"}
        from utils.jwt import verify_token, is_jwt_token
        token = authorization.replace("Bearer ", "")
        if not is_jwt_token(token):
            return {"success": False, "error": "Invalid token"}
        payload = verify_token(token, "access")
        if not payload:
            return {"success": False, "error": "Invalid token"}
        student_id = payload.get("sub")
        reminder = data.get("reminder_minutes", 15)
        if reminder not in (5, 15, 30):
            reminder = 15
        await database.execute(
            "UPDATE push_subscriptions SET reminder_minutes = :rem WHERE student_id = :sid",
            {"rem": reminder, "sid": student_id}
        )
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.get("/api/push/config")
async def get_push_config():
    """Return VAPID Public Key for frontend"""
    return {"vapid_public_key": VAPID_PUBLIC_KEY}


@router.get("/api/subscribe-settings")
async def get_subscribe_settings(authorization: str = Header(None)):
    """Return reminder_minutes for current user if subscribed."""
    try:
        if not authorization:
            return {"reminder_minutes": 15}
        from utils.jwt import verify_token, is_jwt_token
        token = authorization.replace("Bearer ", "")
        if not is_jwt_token(token):
            return {"reminder_minutes": 15}
        payload = verify_token(token, "access")
        if not payload:
            return {"reminder_minutes": 15}
        student_id = payload.get("sub")
        row = await database.fetch_one(
            "SELECT reminder_minutes FROM push_subscriptions WHERE student_id = :sid",
            {"sid": student_id}
        )
        return {"reminder_minutes": int(row["reminder_minutes"]) if row and row.get("reminder_minutes") is not None else 15}
    except Exception:
        return {"reminder_minutes": 15}

@router.post("/api/admin/push")
async def send_push_notification(data: dict, user = Depends(require_admin)):
    """Send push notification to all subscribers"""
    if not VAPID_PRIVATE_KEY:
        return {"success": False, "error": "VAPID key not configured"}
        
    try:
        message = data.get("message", "Новое уведомление")
        title = data.get("title", "МХТ-223")
        url = data.get("url", "/")
        
        payload = json.dumps({
            "title": title,
            "body": message,
            "url": url,
            "icon": "/static/icons/icon-192x192.png"
        })
        
        # Get all subscriptions
        query = "SELECT * FROM push_subscriptions"
        rows = await database.fetch_all(query=query)
        
        sent_count = 0
        failed_count = 0
        removed_count = 0
        
        for row in rows:
            try:
                subscription_info = json.loads(row["subscription_data"])
                
                webpush(
                    subscription_info=subscription_info,
                    data=payload,
                    vapid_private_key=VAPID_PRIVATE_KEY,
                    vapid_claims={"sub": VAPID_CLAIM_EMAIL}
                )
                sent_count += 1
            except WebPushException as ex:
                if ex.response and ex.response.status_code in [404, 410]:
                    # Subscription is expired or invalid, remove it
                    await database.execute(
                        "DELETE FROM push_subscriptions WHERE id = :id", 
                        {"id": row["id"]}
                    )
                    removed_count += 1
                else:
                    print(f"Push error for {row['student_id']}: {ex}")
                    failed_count += 1
            except Exception as e:
                print(f"Generic push error: {e}")
                failed_count += 1
                
        return {
            "success": True, 
            "sent": sent_count, 
            "failed": failed_count, 
            "removed_stale": removed_count
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

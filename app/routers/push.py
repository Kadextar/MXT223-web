from fastapi import APIRouter, Header, Depends
from app.database import database
from app.config import VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_CLAIM_EMAIL
from app.dependencies import require_admin
import json
from pywebpush import webpush, WebPushException

router = APIRouter()

@router.post("/api/subscribe")
async def subscribe_push(data: dict, authorization: str = Header(None)):
    """Subscribe to push notifications"""
    try:
        # Require auth to link to student (optional, but good for tracking)
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

        # Store subscription
        subscription_json = json.dumps(data)
        
        check_query = "SELECT id FROM push_subscriptions WHERE student_id = :sid"
        existing = await database.fetch_one(query=check_query, values={"sid": student_id})
        
        if existing:
            await database.execute(
                "UPDATE push_subscriptions SET subscription_data = :data WHERE student_id = :sid",
                {"data": subscription_json, "sid": student_id}
            )
        else:
            await database.execute(
                "INSERT INTO push_subscriptions (student_id, subscription_data) VALUES (:sid, :data)",
                {"sid": student_id, "data": subscription_json}
            )
            
        return {"success": True}
    except Exception as e:
        print(f"Subscribe error: {e}")
        return {"success": False, "error": str(e)}

@router.get("/api/push/config")
async def get_push_config():
    """Return VAPID Public Key for frontend"""
    return {"vapid_public_key": VAPID_PUBLIC_KEY}

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

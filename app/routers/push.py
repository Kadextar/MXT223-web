import json
from fastapi import APIRouter, Header, Depends, BackgroundTasks
from fastapi.responses import JSONResponse
from pywebpush import webpush, WebPushException
from app.database import database
from app.config import VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_CLAIM_EMAIL
from app.dependencies import require_admin
from app.logging_config import logger

router = APIRouter(tags=["Push"])

@router.post("/subscribe")
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
        logger.info("push_subscribed", extra={"student_id": student_id})
        return {"success": True}
    except Exception as e:
        logger.exception("Subscribe error")
        return {"success": False, "error": str(e)}

@router.get("/push/config")
async def get_push_config():
    """Return VAPID Public Key for frontend"""
    return {"vapid_public_key": VAPID_PUBLIC_KEY}

async def _send_push_to_all(title: str, body: str, url: str = "/"):
    """Send one push to all subscriptions. Used by admin push and schedule-changed."""
    if not VAPID_PRIVATE_KEY:
        return
    payload = json.dumps({
        "title": title,
        "body": body,
        "url": url,
        "icon": "/static/icons/icon-192x192.png",
    })
    try:
        rows = await database.fetch_all("SELECT * FROM push_subscriptions")
        for row in rows:
            try:
                sub = json.loads(row["subscription_data"])
                webpush(
                    subscription_info=sub,
                    data=payload,
                    vapid_private_key=VAPID_PRIVATE_KEY,
                    vapid_claims={"sub": VAPID_CLAIM_EMAIL},
                )
            except WebPushException as ex:
                if ex.response and ex.response.status_code in [404, 410]:
                    await database.execute("DELETE FROM push_subscriptions WHERE id = :id", {"id": row["id"]})
            except Exception:
                pass
    except Exception as e:
        logger.exception("_send_push_to_all: %s", e)


async def notify_schedule_changed():
    """Call after schedule add/delete to push 'Расписание обновилось'."""
    await _send_push_to_all("МХТ-223", "Расписание обновилось", "/")


@router.post("/admin/push")
async def send_push_notification(
    data: dict, background_tasks: BackgroundTasks, user=Depends(require_admin)
):
    """Queue push to all subscribers; returns immediately (202). Sending runs in background."""
    if not VAPID_PRIVATE_KEY:
        return {"success": False, "error": "VAPID key not configured"}
    message = data.get("message", "Новое уведомление")
    title = data.get("title", "МХТ-223")
    url = data.get("url", "/")
    payload = json.dumps({
        "title": title,
        "body": message,
        "url": url,
        "icon": "/static/icons/icon-192x192.png",
    })
    # Run sending in background so admin gets fast response
    async def send_in_background():
        try:
            query = "SELECT * FROM push_subscriptions"
            rows = await database.fetch_all(query=query)
            sent = failed = removed = 0
            for row in rows:
                try:
                    sub = json.loads(row["subscription_data"])
                    webpush(
                        subscription_info=sub,
                        data=payload,
                        vapid_private_key=VAPID_PRIVATE_KEY,
                        vapid_claims={"sub": VAPID_CLAIM_EMAIL},
                    )
                    sent += 1
                except WebPushException as ex:
                    if ex.response and ex.response.status_code in [404, 410]:
                        await database.execute(
                            "DELETE FROM push_subscriptions WHERE id = :id",
                            {"id": row["id"]},
                        )
                        removed += 1
                    else:
                        failed += 1
                except Exception:
                    failed += 1
            logger.info("Push finished: sent=%s failed=%s removed=%s", sent, failed, removed)
        except Exception as e:
            logger.exception("Background push failed: %s", e)
    background_tasks.add_task(send_in_background)
    return JSONResponse(
        status_code=202,
        content={
            "success": True,
            "status": "accepted",
            "message": "Отправка запущена в фоне",
        },
    )

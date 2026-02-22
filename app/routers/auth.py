import re
from fastapi import APIRouter, Header, HTTPException, Depends, Request
from app.models import (
    LoginRequest,
    ChangePasswordRequest,
    RefreshTokenRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    TOTPVerifyRequest,
)
from app.database import database
from app.dependencies import get_current_user
from app.logging_config import logger
from app.rate_limit import check_rate_limit, check_rate_limit_user
from app.idempotency import get_idempotent_result, set_idempotent_result
from app.config import (
    AVATAR_MAX_LENGTH,
    AVATAR_ALLOWED_PATTERN,
    REMEMBER_ME_REFRESH_DAYS,
    PASSWORD_RESET_EXPIRE_MINUTES,
)

router = APIRouter(tags=["Auth"])


def _validate_avatar(avatar: str) -> None:
    if not avatar or len(avatar) > AVATAR_MAX_LENGTH:
        raise HTTPException(status_code=400, detail="Invalid avatar length")
    if not re.match(AVATAR_ALLOWED_PATTERN, avatar):
        raise HTTPException(
            status_code=400,
            detail="Avatar must be a filename like 1.png, 2.jpg (alphanumeric, -_, .png/.jpg/.jpeg/.gif/.webp)",
        )


@router.put("/me/avatar")
async def update_avatar(data: dict, current_user: dict = Depends(get_current_user)):
    """Update user avatar. Allowed: alphanumeric filenames with .png/.jpg/.jpeg/.gif/.webp."""
    avatar = data.get("avatar")
    if not avatar:
        raise HTTPException(status_code=400, detail="Avatar required")
    _validate_avatar(avatar)
    try:
        await database.execute(
            "UPDATE students SET avatar = :avatar WHERE telegram_id = :tid",
            {"avatar": avatar, "tid": current_user["telegram_id"]},
        )
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.get("/me")
async def read_users_me(current_user: dict = Depends(get_current_user)):
    """Get current user info from token (uses dependency)"""
    # Get extra stats
    import hashlib
    user_hash = hashlib.sha256(current_user["telegram_id"].encode()).hexdigest()
    
    ratings_count = await database.fetch_val(
        "SELECT COUNT(*) FROM teacher_ratings WHERE student_hash = :hash",
        {"hash": user_hash}
    )
    
    student_details = await database.fetch_one(
        "SELECT created_at, avatar FROM students WHERE telegram_id = :tid",
        {"tid": current_user["telegram_id"]}
    )
    
    response = dict(current_user)
    response["created_at"] = str(student_details["created_at"]) if student_details and student_details["created_at"] else "N/A"
    response["avatar"] = student_details["avatar"] if student_details and student_details["avatar"] else "1.png"
    response["ratings_count"] = ratings_count
    
    return response

@router.post("/login")
async def login_student(http_request: Request, request: LoginRequest):
    """Authenticate student with telegram_id and password"""
    check_rate_limit(http_request)
    try:
        from utils.auth import verify_password, is_password_hashed, hash_password
        from utils.jwt import create_access_token, create_refresh_token
        
        # Get student with password hash
        query = "SELECT telegram_id, name, password, totp_secret FROM students WHERE telegram_id = :telegram_id"
        student = await database.fetch_one(query=query, values={"telegram_id": request.telegram_id})
        
        if not student:
            return {"success": False, "error": "Неверный ID или пароль"}
        
        # Check if password is hashed or plain text (for backward compatibility during migration)
        if is_password_hashed(student["password"]):
            # New hashed password
            if not verify_password(request.password, student["password"]):
                return {"success": False, "error": "Неверный ID или пароль"}
        else:
            # Old plain text password - check and migrate
            if student["password"] != request.password:
                return {"success": False, "error": "Неверный ID или пароль"}
            
            # Migrate to hashed password
            hashed = hash_password(request.password)
            await database.execute(
                "UPDATE students SET password = :password WHERE telegram_id = :telegram_id",
                {"password": hashed, "telegram_id": request.telegram_id}
            )
        
        # 2FA: if user has TOTP, require code in same request
        row = await database.fetch_one(
            "SELECT totp_secret FROM students WHERE telegram_id = :tid",
            {"tid": request.telegram_id}
        )
        totp_secret = dict(row).get("totp_secret") if row else None
        if totp_secret:
            if not request.totp_code or len(request.totp_code.strip()) != 6:
                return {"success": False, "error": "Введите 6-значный код из приложения", "require_totp": True}
            import pyotp
            totp = pyotp.TOTP(totp_secret)
            if not totp.verify(request.totp_code.strip(), valid_window=1):
                return {"success": False, "error": "Неверный код"}

        refresh_days = REMEMBER_ME_REFRESH_DAYS if getattr(request, "remember_me", False) else None
        access_token = create_access_token({"sub": student["telegram_id"]})
        refresh_token = create_refresh_token(
            {"sub": student["telegram_id"]},
            days=refresh_days,
        )
        logger.info("login_success", extra={"user_id": student["telegram_id"]})
        try:
            from app.routers.extras import _grant_achievement
            await _grant_achievement(student["telegram_id"], "first_login")
        except Exception:
            pass

        return {
            "success": True,
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": {
                "telegram_id": student["telegram_id"],
                "name": student["name"]
            }
        }
    except Exception as e:
        logger.exception("Login error")
        return {"success": False, "error": f"Ошибка сервера: {str(e)}"}

@router.post("/refresh")
async def refresh_access_token(http_request: Request, request: RefreshTokenRequest):
    """Refresh access token using refresh token"""
    check_rate_limit(http_request)
    try:
        from utils.jwt import verify_token, create_access_token, create_refresh_token
        
        # Verify refresh token
        payload = verify_token(request.refresh_token, "refresh")
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        
        telegram_id = payload.get("sub")
        
        # Verify user still exists
        student = await database.fetch_one(
            "SELECT telegram_id, name FROM students WHERE telegram_id = :telegram_id",
            {"telegram_id": telegram_id}
        )
        
        if not student:
            raise HTTPException(status_code=401, detail="User not found")
        
        # Generate new tokens
        new_access_token = create_access_token({"sub": telegram_id})
        new_refresh_token = create_refresh_token({"sub": telegram_id})
        
        return {
            "access_token": new_access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Token refresh error")
        raise HTTPException(status_code=500, detail="Server error")

@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    authorization: str = Header(None),
    idempotency_key: str = Header(None, alias="Idempotency-Key"),
):
    """Change student password. Optional Idempotency-Key to avoid duplicate submit."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        from fastapi.responses import JSONResponse
        from utils.auth import verify_password, hash_password, is_password_hashed
        from utils.jwt import verify_token

        token = authorization.replace("Bearer ", "")
        payload = verify_token(token, "access")
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")
        telegram_id = payload.get("sub")

        check_rate_limit_user(telegram_id)
        # Idempotency: return cached response if same key already succeeded
        key = f"idem:{idempotency_key}" if idempotency_key and len(idempotency_key) <= 128 else None
        if key:
            cached = get_idempotent_result(key)
            if cached:
                status, body = cached
                return JSONResponse(content=body, status_code=status)

        # Get student with current password
        check_query = "SELECT id, password FROM students WHERE telegram_id = :telegram_id"
        student = await database.fetch_one(query=check_query, values={"telegram_id": telegram_id})
        
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        
        # Verify old password (support both hashed and plain text)
        if is_password_hashed(student["password"]):
            if not verify_password(request.old_password, student["password"]):
                return {"success": False, "error": "Неверный старый пароль"}
        else:
            if student["password"] != request.old_password:
                return {"success": False, "error": "Неверный старый пароль"}
        
        # Hash new password
        hashed_new_password = hash_password(request.new_password)
        
        update_query = "UPDATE students SET password = :new_password WHERE telegram_id = :telegram_id"
        await database.execute(query=update_query, values={"new_password": hashed_new_password, "telegram_id": telegram_id})
        logger.info("password_changed", extra={"user_id": telegram_id})

        body = {"success": True, "message": "Пароль успешно изменён"}
        if key:
            set_idempotent_result(key, 200, body)
        return body
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Password change error")
        raise HTTPException(status_code=500, detail="Server error")


# ----- 2FA TOTP -----
@router.get("/me/2fa/status")
async def get_2fa_status(current_user: dict = Depends(get_current_user)):
    """Return whether 2FA is enabled for current user."""
    row = await database.fetch_one(
        "SELECT totp_secret FROM students WHERE telegram_id = :tid",
        {"tid": current_user["telegram_id"]}
    )
    has_secret = row and dict(row).get("totp_secret")
    return {"totp_enabled": bool(has_secret)}


@router.post("/me/2fa/enable")
async def enable_2fa(current_user: dict = Depends(get_current_user)):
    """Generate TOTP secret and return QR URI for authenticator app. Call /me/2fa/verify with code to confirm."""
    import pyotp
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    name = current_user.get("name") or current_user["telegram_id"]
    issuer = "MXT223"
    uri = totp.provisioning_uri(name=name, issuer_name=issuer)
    await database.execute(
        "UPDATE students SET totp_secret = :s WHERE telegram_id = :tid",
        {"s": secret, "tid": current_user["telegram_id"]}
    )
    return {"secret": secret, "qr_uri": uri}


@router.post("/me/2fa/verify")
async def verify_2fa_setup(body: TOTPVerifyRequest, current_user: dict = Depends(get_current_user)):
    """Verify TOTP code to confirm 2FA setup. Secret already saved by /enable; this just verifies."""
    import pyotp
    row = await database.fetch_one(
        "SELECT totp_secret FROM students WHERE telegram_id = :tid",
        {"tid": current_user["telegram_id"]}
    )
    if not row or not dict(row).get("totp_secret"):
        raise HTTPException(status_code=400, detail="2FA not enabled")
    totp = pyotp.TOTP(dict(row)["totp_secret"])
    if not totp.verify(body.code.strip(), valid_window=1):
        raise HTTPException(status_code=400, detail="Неверный код")
    return {"success": True}


@router.post("/me/2fa/disable")
async def disable_2fa(body: TOTPVerifyRequest, current_user: dict = Depends(get_current_user)):
    """Disable 2FA after verifying current code."""
    import pyotp
    row = await database.fetch_one(
        "SELECT totp_secret FROM students WHERE telegram_id = :tid",
        {"tid": current_user["telegram_id"]}
    )
    if not row or not dict(row).get("totp_secret"):
        return {"success": True}
    totp = pyotp.TOTP(dict(row)["totp_secret"])
    if not totp.verify(body.code.strip(), valid_window=1):
        raise HTTPException(status_code=400, detail="Неверный код")
    await database.execute(
        "UPDATE students SET totp_secret = NULL WHERE telegram_id = :tid",
        {"tid": current_user["telegram_id"]}
    )
    return {"success": True}


# ----- Password recovery -----
@router.post("/forgot-password")
async def forgot_password(http_request: Request, req: ForgotPasswordRequest):
    """Create password reset token for telegram_id. In production send link by email/Telegram."""
    check_rate_limit(http_request)
    from datetime import datetime, timedelta
    import secrets
    student = await database.fetch_one(
        "SELECT telegram_id FROM students WHERE telegram_id = :tid",
        {"tid": req.telegram_id}
    )
    if not student:
        return {"success": True, "message": "Если пользователь есть, ссылка отправлена"}
    token = secrets.token_urlsafe(32)
    expires = datetime.utcnow() + timedelta(minutes=PASSWORD_RESET_EXPIRE_MINUTES)
    await database.execute(
        "INSERT INTO password_reset_tokens (token, telegram_id, expires_at) VALUES (:t, :tid, :exp)",
        {"t": token, "tid": req.telegram_id, "exp": expires}
    )
    reset_link = f"/login.html?reset={token}"
    logger.info("password_reset_requested", extra={"telegram_id": req.telegram_id})
    return {"success": True, "reset_token": token, "reset_link": reset_link}


@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest):
    """Set new password using reset token."""
    from datetime import datetime
    from utils.auth import hash_password
    row = await database.fetch_one(
        "SELECT telegram_id, expires_at FROM password_reset_tokens WHERE token = :t",
        {"t": req.token}
    )
    if not row or (row["expires_at"] and row["expires_at"] < datetime.utcnow()):
        raise HTTPException(status_code=400, detail="Ссылка недействительна или истекла")
    hashed = hash_password(req.new_password)
    await database.execute(
        "UPDATE students SET password = :p WHERE telegram_id = :tid",
        {"p": hashed, "tid": row["telegram_id"]}
    )
    await database.execute("DELETE FROM password_reset_tokens WHERE token = :t", {"t": req.token})
    logger.info("password_reset_done", extra={"telegram_id": row["telegram_id"]})
    return {"success": True, "message": "Пароль изменён. Войдите с новым паролем."}

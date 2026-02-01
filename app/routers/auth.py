from fastapi import APIRouter, Header, HTTPException, Depends
from app.models import LoginRequest, ChangePasswordRequest, RefreshTokenRequest
from app.database import database
from app.dependencies import get_current_user

router = APIRouter()

@router.put("/api/me/avatar")
async def update_avatar(data: dict, current_user: dict = Depends(get_current_user)):
    """Update user avatar"""
    avatar = data.get("avatar")
    if not avatar:
        raise HTTPException(status_code=400, detail="Avatar required")
        
    try:
        await database.execute(
            "UPDATE students SET avatar = :avatar WHERE telegram_id = :tid",
            {"avatar": avatar, "tid": current_user["telegram_id"]}
        )
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.get("/api/me")
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

@router.post("/api/login")
async def login_student(request: LoginRequest):
    """Authenticate student with telegram_id and password"""
    try:
        from utils.auth import verify_password, is_password_hashed, hash_password
        from utils.jwt import create_access_token, create_refresh_token
        
        # Get student with password hash
        query = "SELECT telegram_id, name, password FROM students WHERE telegram_id = :telegram_id"
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
        
        # Generate JWT tokens
        access_token = create_access_token({"sub": student["telegram_id"]})
        refresh_token = create_refresh_token({"sub": student["telegram_id"]})
        
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
        print(f"Login error: {e}")
        return {"success": False, "error": f"Ошибка сервера: {str(e)}"}

@router.post("/api/refresh")
async def refresh_access_token(request: RefreshTokenRequest):
    """Refresh access token using refresh token"""
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
        print(f"Token refresh error: {e}")
        raise HTTPException(status_code=500, detail="Server error")

@router.post("/api/change-password")
async def change_password(request: ChangePasswordRequest, authorization: str = Header(None)):
    """Change student password"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        from utils.auth import verify_password, hash_password, is_password_hashed
        from utils.jwt import verify_token
        
        # Extract token
        token = authorization.replace("Bearer ", "")
        
        # Verify and decode token
        payload = verify_token(token, "access")
        if not payload:
             raise HTTPException(status_code=401, detail="Invalid token")
             
        telegram_id = payload.get("sub")
        
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
        
        # Update password
        update_query = "UPDATE students SET password = :new_password WHERE telegram_id = :telegram_id"
        await database.execute(query=update_query, values={"new_password": hashed_new_password, "telegram_id": telegram_id})
        
        return {"success": True, "message": "Пароль успешно изменён"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Password change error: {e}")
        raise HTTPException(status_code=500, detail="Server error")
